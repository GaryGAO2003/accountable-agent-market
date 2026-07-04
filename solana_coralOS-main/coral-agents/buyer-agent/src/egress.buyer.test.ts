/**
 * L2 Egress PEP - buyer wiring (T2). Exercises the exact policy + choke point the buyer loop uses:
 *   - buildEgressPolicy: the env -> EgressPolicy mapping (which recipient/velocity/budget fences arm).
 *   - checkEgressAudited: the deposit/release/refund gate (audit trail + EGRESS_DENIED wire notice + verdict).
 *
 * The runtime PEP semantics themselves live in packages/agent-runtime (market/egress.test.ts); this file
 * proves the buyer-side wiring: a hijacked payout is refused before any deposit, the shared-wallet default
 * still funds (backward compat), a replayed reference is caught across rounds, and a burst is throttled.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  newEgressState, AuditLog, checkEgress, commitEgress,
  type EgressAction, type EgressPolicy, type EgressState, type EgressDecision,
} from '@pay/agent-runtime'
import { buildEgressPolicy, checkEgressAudited } from './guard.js'

const EXPECTED = '7jwB6M2DtuDuXJvFT9RiEwDQUX6Q3DhwtDwg3v8DpjZw' // the buyer's trust-root payout wallet
const HIJACK = 'HiJ4ckAttackerWa11etDoNotPayMe11111111111111'   // a mid-thread payout swap (seller-hijack)
const REF = 'Ref11111111111111111111111111111111111111111'
const LAMPORTS_PER_SOL = 1_000_000_000

interface Terms { seller: string; amountSol: number; reference: string }

/** Faithful stand-in for the buyer's deposit call site: gate, then deposit + commit ONLY on allow. */
async function settleDeposit(
  policy: EgressPolicy,
  state: EgressState,
  audit: AuditLog,
  round: number,
  terms: Terms,
  deposit: () => Promise<unknown>,
): Promise<{ deposited: boolean; sent: string[]; verdict: EgressDecision }> {
  const sent: string[] = []
  const action: EgressAction = { kind: 'deposit', recipient: terms.seller, amountSol: terms.amountSol, reference: terms.reference }
  const verdict = await checkEgressAudited(state, policy, audit, round, action, (l) => { sent.push(l) })
  if (!verdict.allow) return { deposited: false, sent, verdict }
  await deposit()
  commitEgress(state, action, Date.now()) // check -> act -> commit
  return { deposited: true, sent, verdict }
}

describe('buildEgressPolicy - buyer session policy from env controls', () => {
  it('binds the payout wallet as the sole recipient + always arms velocity, no reference list', () => {
    const p = buildEgressPolicy({ expectedSellerWallet: EXPECTED, maxTxPerMin: 6, sessionBudgetSol: 0 })
    expect(p.allowedRecipients).toEqual(new Set([EXPECTED]))
    expect(p.velocity).toEqual({ maxActions: 6, windowMs: 60_000 })
    expect(p.budgetLamports).toBeUndefined()    // 0 => no cap
    expect(p.allowedReferences).toBeUndefined() // per-round seller reference is never pre-listed
  })

  it('leaves the recipient check open when the wallet is unset, and maps a >0 budget to lamports', () => {
    const p = buildEgressPolicy({ expectedSellerWallet: '', maxTxPerMin: 6, sessionBudgetSol: 0.5 })
    expect(p.allowedRecipients).toBeUndefined()
    expect(p.budgetLamports).toBe(Math.round(0.5 * LAMPORTS_PER_SOL))
  })
})

describe('buyer deposit egress gate', () => {
  it('(a) refuses a hijacked payout wallet: RECIPIENT_NOT_ALLOWED, no deposit, EGRESS_DENIED audited', async () => {
    const policy = buildEgressPolicy({ expectedSellerWallet: EXPECTED, maxTxPerMin: 6, sessionBudgetSol: 0 })
    const state = newEgressState()
    const audit = new AuditLog('buyer')
    const deposit = vi.fn(async () => 'sig')

    const { deposited, sent, verdict } = await settleDeposit(
      policy, state, audit, 7, { seller: HIJACK, amountSol: 0.001, reference: REF }, deposit,
    )

    expect(deposited).toBe(false)
    if (!verdict.allow) expect(verdict.code).toBe('RECIPIENT_NOT_ALLOWED')
    expect(deposit).not.toHaveBeenCalled()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatch(/^EGRESS_DENIED round=7 code=RECIPIENT_NOT_ALLOWED action=deposit detail=/)
    expect(audit.entries.at(-1)?.decision).toBe('DENY')
    expect(state.spentLamports).toBe(0) // nothing committed on a denied action
  })

  it('(b) funds the same terms when EXPECTED_SELLER_WALLET is unset (backward compat)', async () => {
    const policy = buildEgressPolicy({ expectedSellerWallet: '', maxTxPerMin: 6, sessionBudgetSol: 0 })
    const state = newEgressState()
    const audit = new AuditLog('buyer')
    const deposit = vi.fn(async () => 'sig')

    const { deposited, sent, verdict } = await settleDeposit(
      policy, state, audit, 1, { seller: HIJACK, amountSol: 0.001, reference: REF }, deposit,
    )

    expect(deposited).toBe(true)
    expect(verdict.allow).toBe(true)
    expect(deposit).toHaveBeenCalledTimes(1)
    expect(sent).toHaveLength(0) // no EGRESS_DENIED surfaced
    expect(audit.entries.at(-1)?.decision).toBe('ALLOW')
    expect(state.spentLamports).toBe(Math.round(0.001 * LAMPORTS_PER_SOL)) // committed after the deposit landed
  })

  it('rejects a seller replaying an escrow reference across rounds (REFERENCE_REUSED)', async () => {
    const policy = buildEgressPolicy({ expectedSellerWallet: EXPECTED, maxTxPerMin: 6, sessionBudgetSol: 0 })
    const state = newEgressState()
    const audit = new AuditLog('buyer')
    const deposit = vi.fn(async () => 'sig')
    const terms: Terms = { seller: EXPECTED, amountSol: 0.001, reference: REF }

    const first = await settleDeposit(policy, state, audit, 1, terms, deposit)
    const replay = await settleDeposit(policy, state, audit, 2, terms, deposit) // same reference, next round

    expect(first.deposited).toBe(true)
    expect(replay.deposited).toBe(false)
    if (!replay.verdict.allow) expect(replay.verdict.code).toBe('REFERENCE_REUSED')
    expect(deposit).toHaveBeenCalledTimes(1) // only the first round funded
  })
})

describe('buyer money-action velocity fence', () => {
  it('(d) throttles the 7th money action inside the 60s window', () => {
    const policy = buildEgressPolicy({ expectedSellerWallet: EXPECTED, maxTxPerMin: 6, sessionBudgetSol: 0 })
    const state = newEgressState()
    const now = 1_700_000_000_000
    state.actionTimesMs = [now, now, now, now, now, now] // 6 money actions already sent this minute
    const seventh: EgressAction = { kind: 'deposit', recipient: EXPECTED, amountSol: 0.0001, reference: 'fresh-ref' }
    const d = checkEgress(state, policy, seventh, now)
    expect(d.allow).toBe(false)
    if (!d.allow) expect(d.code).toBe('VELOCITY_EXCEEDED')
  })
})
