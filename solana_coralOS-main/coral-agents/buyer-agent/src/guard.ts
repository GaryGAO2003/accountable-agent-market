import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  checkEgress, formatEgressAudit, formatEgressDenied,
  type EgressPolicy, type EgressState, type EgressAction, type EgressDecision, type AuditLog,
} from '@pay/agent-runtime'

/** Per-purchase, code-enforced trust state: which recipients/references are payable, and total spent. */
export interface PurchaseGuard {
  /** Recipients the buyer actually saw in a real 402 challenge - the only ones it may pay. */
  allowedRecipients: Set<string>
  /** References the buyer saw in a real challenge. */
  allowedReferences: Set<string>
  /** Cumulative spend across the whole loop, capped at the budget. */
  spentLamports: number
}

export interface PaymentInput {
  recipient: string
  amountSol: number
  reference?: string
}

export type GuardResult = { allowed: true; lamports: number } | { allowed: false; reason: string }

/**
 * The buyer's payment rules for the legacy 402 pay-per-call loop (`llm_buyer.ts`), **enforced in code,
 * not in the prompt**. A prompt injection in fetched data cannot bypass these:
 *   - H2: the recipient (and reference) must have appeared in a real 402 challenge.
 *   - M3: cumulative spend across the loop must stay within the budget.
 *
 * Enforcement is now **unified in the runtime Egress PEP**: this is a thin wrapper over `checkEgress`
 * (@pay/agent-runtime), mapping the per-loop `PurchaseGuard` onto an `EgressPolicy` + `EgressState`. It
 * stays as a stable façade so its caller + tests are unchanged. Returns whether the payment is allowed;
 * the caller only sends on `{ allowed: true }`.
 */
export function guardPayment(guard: PurchaseGuard, input: PaymentInput, budgetLamports: number): GuardResult {
  const lamports = Math.round(input.amountSol * LAMPORTS_PER_SOL)
  // guardPayment ALWAYS enforces the recipient set, even when empty; `checkEgress` skips an *empty*
  // allowlist for backward-compat, so short-circuit the empty/miss case here to preserve strictness (H2).
  if (!guard.allowedRecipients.has(input.recipient)) {
    return { allowed: false, reason: `recipient ${input.recipient} did not appear in any payment challenge` }
  }
  const policy: EgressPolicy = {
    allowedRecipients: guard.allowedRecipients,
    allowedReferences: guard.allowedReferences,
    budgetLamports,
  }
  // A fresh, per-call state seeded with the loop's cumulative spend: the reference/velocity replay
  // counters do not apply to this façade (it never checked replay), only H2 recipient/ref + M3 budget.
  const state: EgressState = { spentLamports: guard.spentLamports, usedReferences: new Set(), actionTimesMs: [] }
  const action: EgressAction = {
    kind: 'deposit', recipient: input.recipient, amountSol: input.amountSol,
    ...(input.reference ? { reference: input.reference } : {}),
  }
  const verdict = checkEgress(state, policy, action, Date.now())
  // `checkEgress` returns only a verdict; guardPayment's contract also hands back the computed `lamports`.
  return verdict.allow ? { allowed: true, lamports } : { allowed: false, reason: verdict.detail }
}

/**
 * F3: bind the awarded seller to the escrow payout pubkey. The buyer should only deposit if the
 * `seller=` carried in `ESCROW_REQUIRED` matches the wallet it expects for the winner - otherwise a
 * thread participant could redirect the payout. With an empty `expected` (no seller wallet configured)
 * this is a no-op, which is the demo default since the personas share one receive wallet.
 *
 * Enforcement of this bind is now **unified in the runtime PEP**: the buyer feeds the expected wallet
 * into `EgressPolicy.allowedRecipients`, so a redirected payout trips `RECIPIENT_NOT_ALLOWED` (and is
 * audited) at the deposit choke point. This predicate is retained for direct unit checks / callers that
 * want the bare boolean.
 */
export function payoutMatches(escrowSeller: string, expected: string): boolean {
  return !expected || escrowSeller === expected
}

/**
 * Assemble the buyer session's egress policy from its three operator controls. Kept here (not inline in
 * index.ts) so the exact env→policy mapping is unit-testable:
 *   - `expectedSellerWallet` (non-empty) → `allowedRecipients = { it }`: the single payout wallet the
 *     buyer may send NEW money to (deposit/release); anything else is `RECIPIENT_NOT_ALLOWED`. Empty →
 *     left unset (the recipient check is skipped - the shared-wallet demo default).
 *   - `maxTxPerMin` → `velocity { maxActions, windowMs: 60_000 }`: burst cap across ALL money actions.
 *   - `sessionBudgetSol` (> 0) → `budgetLamports`: cumulative deposit/transfer cap. 0 → no cap.
 * `allowedReferences` is deliberately NOT set: the buyer trusts the per-round escrow reference the
 * winning seller issues (there is no pre-issued list), and `REFERENCE_REUSED` (state-based) still blocks
 * a seller replaying a reference across rounds.
 */
export function buildEgressPolicy(opts: {
  expectedSellerWallet?: string
  maxTxPerMin: number
  sessionBudgetSol: number
}): EgressPolicy {
  const policy: EgressPolicy = { velocity: { maxActions: opts.maxTxPerMin, windowMs: 60_000 } }
  if (opts.expectedSellerWallet) policy.allowedRecipients = new Set([opts.expectedSellerWallet])
  if (opts.sessionBudgetSol > 0) policy.budgetLamports = Math.round(opts.sessionBudgetSol * LAMPORTS_PER_SOL)
  return policy
}

/**
 * The buyer's egress choke point around one money action - wraps the runtime PEP's pure `checkEgress`
 * with the audit + wire-notice side effects the market loop needs:
 *   1. decide (`checkEgress` against the session policy + running counters),
 *   2. append the verdict to the audit trail and mirror the entry to stdout (docker logs = one audit sink),
 *   3. surface an `EGRESS_AUDIT` line through `notify` for the shared-thread firewall console,
 *   4. on a denial, also surface the terminal `EGRESS_DENIED` line so the round folds to blocked.
 * Returns the decision so the caller performs the tx and calls `commitEgress` **only** on `{ allow: true }`
 * (check → act → commit - a denied or unsent action must never advance the counters).
 */
export async function checkEgressAudited(
  state: EgressState,
  policy: EgressPolicy,
  audit: AuditLog,
  round: number,
  action: EgressAction,
  notify: (line: string) => void | Promise<void>,
  nowMs: number = Date.now(),
): Promise<EgressDecision> {
  const verdict = checkEgress(state, policy, action, nowMs)
  const entry = audit.record(action, verdict)
  console.log('[egress]', JSON.stringify(entry))
  await notify(formatEgressAudit({
    round,
    seq: entry.seq,
    decision: entry.decision,
    action: action.kind,
    ...(entry.code ? { code: entry.code } : {}),
    detail: entry.detail ?? entry.action,
  }))
  if (!verdict.allow) await notify(formatEgressDenied(round, verdict.code, action.kind, verdict.detail))
  return verdict
}
