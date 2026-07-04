/**
 * Egress Policy Enforcement Point (PEP) - the single choke point every outbound agent action passes
 * through **before** it happens. Money movement (deposit/release/refund/transfer) and outbound HTTP are
 * both checked here, and every decision - allow or deny - is auditable.
 *
 * The design principle is **"the model proposes, code disposes"**: an LLM completion, or a hijacked
 * thread message crafted by another participant, can *ask* the agent to pay the wrong wallet, replay a
 * reference, blow the budget, or beacon out to an attacker host - but it cannot *do* any of those,
 * because the deciding logic lives in code the prompt can't reach. `checkEgress` is a pure function (no
 * clock, no I/O) so the same inputs always yield the same verdict and CI can pin every branch.
 */
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * Why an outbound action was refused. **Frozen taxonomy** - the dashboard feed and the docs key off
 * these exact strings, so codes are append-only, never renamed.
 *
 * `SCHEMA_INVALID` and `INTEGRITY_MISMATCH` are **reserved**: they are emitted by *callers* - a protocol
 * parser that rejects a malformed wire line, or delivery verification that finds tampered bytes - and
 * are surfaced on the same audit/wire channel via `formatEgressDenied`. `checkEgress` itself never
 * returns them; it only knows about the money/host/velocity fences below.
 */
export type ReasonCode =
  | 'RECIPIENT_NOT_ALLOWED' | 'REFERENCE_UNKNOWN' | 'REFERENCE_REUSED'
  | 'BUDGET_EXCEEDED' | 'VELOCITY_EXCEEDED' | 'AMOUNT_INVALID'
  | 'HOST_NOT_ALLOWED' | 'SCHEMA_INVALID' | 'INTEGRITY_MISMATCH'

/**
 * An outbound action about to leave the agent. Money kinds carry a recipient + amount (deposit locks
 * escrow, release pays the seller, refund returns to self, transfer is a bare send); `http` is any
 * outbound call the agent wants to make.
 */
export type EgressAction =
  | { kind: 'deposit' | 'release' | 'refund' | 'transfer'; recipient: string; amountSol: number; reference?: string }
  | { kind: 'http'; host: string }

export interface EgressPolicy {
  /** Cumulative spend cap in lamports (deposit/transfer count; release/refund move already-counted escrow money). 0 or missing = no cap. */
  budgetLamports?: number
  /** Payout wallets the agent may send NEW money to (deposit/transfer/release). Empty set/undefined = check skipped (backward compatible). Does NOT apply to kind 'refund' (money returns to self). */
  allowedRecipients?: Set<string>
  /** If provided, deposit references must be members (they were seen in a real challenge/terms). */
  allowedReferences?: Set<string>
  /** Sliding-window rate limit over ALL money actions. */
  velocity?: { maxActions: number; windowMs: number }
  /** Hosts an 'http' action may call. Empty/undefined = check skipped. */
  allowedHosts?: Set<string>
}

/**
 * Mutable per-session counters the checks read. The caller owns it; `commitEgress` advances it after an
 * allowed action is actually performed. Kept separate from `EgressPolicy` (the static rules) so the same
 * policy can be reused while state accumulates over a loop.
 */
export interface EgressState {
  spentLamports: number
  usedReferences: Set<string>   // references already consumed by a deposit (replay defense)
  actionTimesMs: number[]       // money-action timestamps inside the velocity window
}

export function newEgressState(): EgressState {
  return { spentLamports: 0, usedReferences: new Set<string>(), actionTimesMs: [] }
}

export type EgressDecision = { allow: true } | { allow: false; code: ReasonCode; detail: string }

/** How long a money-action timestamp is retained by `commitEgress`; bounds memory while comfortably exceeding any realistic velocity window. */
const VELOCITY_MEMORY_MS = 5 * 60_000

const deny = (code: ReasonCode, detail: string): EgressDecision => ({ allow: false, code, detail })

/** Count of timestamps falling inside the closed window `[nowMs - windowMs, nowMs]`. */
function countInWindow(times: readonly number[], nowMs: number, windowMs: number): number {
  const cutoff = nowMs - windowMs
  let n = 0
  for (const t of times) if (t >= cutoff && t <= nowMs) n++
  return n
}

/**
 * Pure decision function - no clock, no I/O; `nowMs` is injected so velocity is deterministic in tests.
 *
 * Checks run in a fixed order and the **first** failure is returned, cheapest/most-fundamental first so
 * the reason surfaced is the most basic thing wrong:
 *   1. AMOUNT_INVALID       - a malformed amount is meaningless before any policy question
 *   2. RECIPIENT_NOT_ALLOWED - *who* receives new money is the primary containment
 *   3. REFERENCE_UNKNOWN     - a deposit reference must trace to a real challenge/terms
 *   4. REFERENCE_REUSED      - ...and must not be a replay of one already consumed
 *   5. BUDGET_EXCEEDED       - cumulative spend cap
 *   6. VELOCITY_EXCEEDED     - burst rate cap over all money actions
 * An `http` action is subject only to HOST_NOT_ALLOWED; none of the money fences apply to it.
 */
export function checkEgress(state: EgressState, policy: EgressPolicy, action: EgressAction, nowMs: number): EgressDecision {
  if (action.kind === 'http') {
    if (policy.allowedHosts && policy.allowedHosts.size > 0 && !policy.allowedHosts.has(action.host)) {
      return deny('HOST_NOT_ALLOWED', `host ${action.host} is not on the egress allowlist`)
    }
    return { allow: true }
  }

  // 1. Amount sanity: reject NaN/Infinity and non-positive amounts before doing lamport math.
  if (!Number.isFinite(action.amountSol) || action.amountSol <= 0) {
    return deny('AMOUNT_INVALID', `amount ${action.amountSol} SOL is not a positive, finite number`)
  }
  const lamports = Math.round(action.amountSol * LAMPORTS_PER_SOL)

  // 2. Recipient allowlist - applies to money leaving to another wallet (deposit/release/transfer),
  //    NOT refund (that returns to self, so an allowlist would only get in the way).
  const movesMoneyOut = action.kind === 'deposit' || action.kind === 'release' || action.kind === 'transfer'
  if (movesMoneyOut && policy.allowedRecipients && policy.allowedRecipients.size > 0 && !policy.allowedRecipients.has(action.recipient)) {
    return deny('RECIPIENT_NOT_ALLOWED', `recipient ${action.recipient} is not an approved payout wallet`)
  }

  // 3 + 4. Reference provenance & replay - only a deposit carries a reference into escrow.
  if (action.kind === 'deposit' && action.reference != null) {
    if (policy.allowedReferences && !policy.allowedReferences.has(action.reference)) {
      return deny('REFERENCE_UNKNOWN', `reference ${action.reference} was never issued in a challenge/terms`)
    }
    if (state.usedReferences.has(action.reference)) {
      return deny('REFERENCE_REUSED', `reference ${action.reference} was already consumed by an earlier deposit`)
    }
  }

  // 5. Cumulative budget - only new money counts (release/refund move escrow already counted at deposit).
  if ((action.kind === 'deposit' || action.kind === 'transfer') && policy.budgetLamports && state.spentLamports + lamports > policy.budgetLamports) {
    return deny('BUDGET_EXCEEDED', `cumulative ${state.spentLamports + lamports} lamports would exceed budget ${policy.budgetLamports}`)
  }

  // 6. Velocity - a burst of money actions inside the window is throttled regardless of budget.
  if (policy.velocity && countInWindow(state.actionTimesMs, nowMs, policy.velocity.windowMs) >= policy.velocity.maxActions) {
    return deny('VELOCITY_EXCEEDED', `${policy.velocity.maxActions} money actions already sent within ${policy.velocity.windowMs}ms`)
  }

  return { allow: true }
}

/**
 * Apply an **allowed** action's effects to the state: record the money-action timestamp (pruning the
 * window to bound memory), consume the deposit reference so it can't be replayed, and add new spend to
 * the running total. Call this only after acting on `{ allow: true }` - committing a denied or unsent
 * action would corrupt the very counters the next `checkEgress` relies on.
 */
export function commitEgress(state: EgressState, action: EgressAction, nowMs: number): void {
  if (action.kind === 'http') return

  state.actionTimesMs.push(nowMs)
  const cutoff = nowMs - VELOCITY_MEMORY_MS
  state.actionTimesMs = state.actionTimesMs.filter((t) => t >= cutoff)

  if (action.kind === 'deposit' && action.reference != null) {
    state.usedReferences.add(action.reference)
  }
  if (action.kind === 'deposit' || action.kind === 'transfer') {
    state.spentLamports += Math.round(action.amountSol * LAMPORTS_PER_SOL)
  }
}

/** One immutable line of the egress audit trail - what was attempted, and how the PEP ruled. */
export interface AuditEntry {
  seq: number
  ts: number
  agent: string
  /** Human-readable action, e.g. `deposit 0.0005 SOL -> <pubkey>` or `http txline.example`. */
  action: string
  decision: 'ALLOW' | 'DENY'
  code?: ReasonCode
  detail?: string
}

/** Render an action for the audit trail (money shows amount + recipient; http shows the host). */
function describeAction(action: EgressAction): string {
  return action.kind === 'http'
    ? `http ${action.host}`
    : `${action.kind} ${action.amountSol} SOL -> ${action.recipient}`
}

/**
 * The append-only egress audit trail for one agent. Every `checkEgress` verdict the agent acts on should
 * be `record`ed here so a denied action leaves the same forensic footprint as an allowed one - the point
 * of a PEP is not just to block, but to make every attempt visible after the fact. Entries are
 * monotonically sequenced (1-based) and timestamped at record time; `toJsonl` emits one JSON object per
 * line for streaming into a log sink or the dashboard.
 */
export class AuditLog {
  readonly #agent: string
  readonly #entries: AuditEntry[] = []
  #seq = 0

  constructor(agent: string) {
    this.#agent = agent
  }

  record(action: EgressAction, decision: EgressDecision): AuditEntry {
    const entry: AuditEntry = {
      seq: ++this.#seq,
      ts: Date.now(),
      agent: this.#agent,
      action: describeAction(action),
      decision: decision.allow ? 'ALLOW' : 'DENY',
      ...(decision.allow ? {} : { code: decision.code, detail: decision.detail }),
    }
    this.#entries.push(entry)
    return entry
  }

  get entries(): readonly AuditEntry[] {
    return this.#entries
  }

  toJsonl(): string {
    return this.#entries.map((e) => JSON.stringify(e)).join('\n')
  }
}
