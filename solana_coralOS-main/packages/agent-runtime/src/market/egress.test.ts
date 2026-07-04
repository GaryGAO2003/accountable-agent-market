import { describe, it, expect } from 'vitest'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  checkEgress, commitEgress, newEgressState, AuditLog,
  type EgressAction,
} from './egress.js'

const A = 'PayeeAAA' // an approved payout wallet
const B = 'PayeeBBB' // some other wallet
const t0 = 1_000_000 // a fixed injected clock

describe('checkEgress - amount sanity', () => {
  for (const amt of [0, -0.001, NaN, Infinity, -Infinity]) {
    it(`denies amountSol=${amt} with AMOUNT_INVALID`, () => {
      const d = checkEgress(newEgressState(), {}, { kind: 'deposit', recipient: A, amountSol: amt }, t0)
      expect(d).toMatchObject({ allow: false, code: 'AMOUNT_INVALID' })
    })
  }
  it('nearest allow: a tiny positive amount passes', () => {
    expect(checkEgress(newEgressState(), {}, { kind: 'deposit', recipient: A, amountSol: 1e-6 }, t0).allow).toBe(true)
  })
})

describe('checkEgress - recipient allowlist', () => {
  const policy = { allowedRecipients: new Set([A]) }
  it('denies deposit/release/transfer to an unlisted recipient', () => {
    for (const kind of ['deposit', 'release', 'transfer'] as const) {
      const d = checkEgress(newEgressState(), policy, { kind, recipient: B, amountSol: 0.001 }, t0)
      expect(d).toMatchObject({ allow: false, code: 'RECIPIENT_NOT_ALLOWED' })
    }
  })
  it('nearest allow: the same kinds to a listed recipient pass', () => {
    for (const kind of ['deposit', 'release', 'transfer'] as const) {
      expect(checkEgress(newEgressState(), policy, { kind, recipient: A, amountSol: 0.001 }, t0).allow).toBe(true)
    }
  })
  it('refund skips the recipient check (money returns to self)', () => {
    expect(checkEgress(newEgressState(), policy, { kind: 'refund', recipient: B, amountSol: 0.001 }, t0).allow).toBe(true)
  })
})

describe('checkEgress - reference provenance & replay', () => {
  it('denies a deposit whose reference was never issued (REFERENCE_UNKNOWN)', () => {
    const policy = { allowedReferences: new Set(['R1']) }
    expect(checkEgress(newEgressState(), policy, { kind: 'deposit', recipient: A, amountSol: 0.001, reference: 'R2' }, t0))
      .toMatchObject({ allow: false, code: 'REFERENCE_UNKNOWN' })
  })
  it('nearest allow: a member reference passes; a missing reference skips the check', () => {
    const policy = { allowedReferences: new Set(['R1']) }
    expect(checkEgress(newEgressState(), policy, { kind: 'deposit', recipient: A, amountSol: 0.001, reference: 'R1' }, t0).allow).toBe(true)
    expect(checkEgress(newEgressState(), policy, { kind: 'deposit', recipient: A, amountSol: 0.001 }, t0).allow).toBe(true)
  })
  it('denies re-using a consumed reference (REFERENCE_REUSED)', () => {
    const st = newEgressState()
    st.usedReferences.add('R1')
    expect(checkEgress(st, {}, { kind: 'deposit', recipient: A, amountSol: 0.001, reference: 'R1' }, t0))
      .toMatchObject({ allow: false, code: 'REFERENCE_REUSED' })
  })
  it('nearest allow: a fresh reference passes', () => {
    const st = newEgressState()
    st.usedReferences.add('R1')
    expect(checkEgress(st, {}, { kind: 'deposit', recipient: A, amountSol: 0.001, reference: 'R2' }, t0).allow).toBe(true)
  })
})

describe('checkEgress - cumulative budget', () => {
  const budgetLamports = 1_000_000 // 0.001 SOL
  const policy = { budgetLamports }
  it('nearest allow: spend exactly at the budget passes', () => {
    const d = checkEgress(newEgressState(), policy, { kind: 'deposit', recipient: A, amountSol: budgetLamports / LAMPORTS_PER_SOL }, t0)
    expect(d.allow).toBe(true)
  })
  it('denies one lamport over the budget (BUDGET_EXCEEDED)', () => {
    const d = checkEgress(newEgressState(), policy, { kind: 'deposit', recipient: A, amountSol: (budgetLamports + 1) / LAMPORTS_PER_SOL }, t0)
    expect(d).toMatchObject({ allow: false, code: 'BUDGET_EXCEEDED' })
  })
  it('release/refund move already-counted escrow money and never hit the cap', () => {
    const st = newEgressState()
    st.spentLamports = budgetLamports // already at the cap
    for (const kind of ['release', 'refund'] as const) {
      expect(checkEgress(st, policy, { kind, recipient: A, amountSol: 5 }, t0).allow).toBe(true)
    }
  })
})

describe('checkEgress - velocity (sliding window, injected clock)', () => {
  const policy = { velocity: { maxActions: 2, windowMs: 1000 } }
  const send: EgressAction = { kind: 'deposit', recipient: A, amountSol: 0.001 }
  it('denies the (max+1)th action inside the window', () => {
    const st = newEgressState()
    st.actionTimesMs = [t0 - 500, t0 - 100] // 2 already inside [t0-1000, t0]
    expect(checkEgress(st, policy, send, t0)).toMatchObject({ allow: false, code: 'VELOCITY_EXCEEDED' })
  })
  it('nearest allow: max-1 inside the window still passes', () => {
    const st = newEgressState()
    st.actionTimesMs = [t0 - 500]
    expect(checkEgress(st, policy, send, t0).allow).toBe(true)
  })
  it('allows again once the window slides past prior actions', () => {
    const st = newEgressState()
    st.actionTimesMs = [t0 - 2000, t0 - 1500] // both older than a 1000ms window
    expect(checkEgress(st, policy, send, t0).allow).toBe(true)
  })
})

describe('checkEgress - http host fence', () => {
  const policy = { allowedHosts: new Set(['good.example']) }
  it('denies an unlisted host (HOST_NOT_ALLOWED)', () => {
    expect(checkEgress(newEgressState(), policy, { kind: 'http', host: 'evil.example' }, t0))
      .toMatchObject({ allow: false, code: 'HOST_NOT_ALLOWED' })
  })
  it('nearest allow: a listed host passes', () => {
    expect(checkEgress(newEgressState(), policy, { kind: 'http', host: 'good.example' }, t0).allow).toBe(true)
  })
  it('empty/undefined allowedHosts skips the check', () => {
    expect(checkEgress(newEgressState(), {}, { kind: 'http', host: 'anything.example' }, t0).allow).toBe(true)
    expect(checkEgress(newEgressState(), { allowedHosts: new Set() }, { kind: 'http', host: 'anything.example' }, t0).allow).toBe(true)
  })
  it('money fences (budget/velocity) do not apply to an http action', () => {
    const st = newEgressState()
    st.spentLamports = 10 * LAMPORTS_PER_SOL
    expect(checkEgress(st, { budgetLamports: 1, velocity: { maxActions: 0, windowMs: 1000 } }, { kind: 'http', host: 'x.example' }, t0).allow).toBe(true)
  })
})

describe('checkEgress - backward compat (empty policy allows everything)', () => {
  it('every action kind is allowed under an empty policy', () => {
    const actions: EgressAction[] = [
      { kind: 'deposit', recipient: B, amountSol: 1, reference: 'R9' },
      { kind: 'release', recipient: B, amountSol: 1 },
      { kind: 'refund', recipient: B, amountSol: 1 },
      { kind: 'transfer', recipient: B, amountSol: 1 },
      { kind: 'http', host: 'x.example' },
    ]
    for (const a of actions) expect(checkEgress(newEgressState(), {}, a, t0).allow).toBe(true)
  })
})

describe('commitEgress', () => {
  it('deposit/transfer accumulate spentLamports; release/refund/http do not', () => {
    const st = newEgressState()
    commitEgress(st, { kind: 'deposit', recipient: A, amountSol: 0.001 }, t0)
    commitEgress(st, { kind: 'transfer', recipient: A, amountSol: 0.002 }, t0)
    expect(st.spentLamports).toBe(3_000_000)
    const before = st.spentLamports
    commitEgress(st, { kind: 'release', recipient: A, amountSol: 5 }, t0)
    commitEgress(st, { kind: 'refund', recipient: A, amountSol: 5 }, t0)
    commitEgress(st, { kind: 'http', host: 'x.example' }, t0)
    expect(st.spentLamports).toBe(before)
  })

  it('consumes a deposit reference so a re-deposit is REFERENCE_REUSED', () => {
    const st = newEgressState()
    const dep: EgressAction = { kind: 'deposit', recipient: A, amountSol: 0.001, reference: 'Rx' }
    expect(checkEgress(st, {}, dep, t0).allow).toBe(true) // first time: fine
    commitEgress(st, dep, t0)
    expect(st.usedReferences.has('Rx')).toBe(true)
    expect(checkEgress(st, {}, dep, t0)).toMatchObject({ allow: false, code: 'REFERENCE_REUSED' })
  })

  it('prunes money-action timestamps older than the memory horizon', () => {
    const st = newEgressState()
    commitEgress(st, { kind: 'deposit', recipient: A, amountSol: 0.001 }, t0)
    const later = t0 + 6 * 60_000 // 6 min later: the first stamp is now beyond the 5-min horizon
    commitEgress(st, { kind: 'deposit', recipient: A, amountSol: 0.001 }, later)
    expect(st.actionTimesMs).toEqual([later])
  })

  it('velocity end-to-end: commit twice, deny the 3rd, allow after the window slides', () => {
    const policy = { velocity: { maxActions: 2, windowMs: 1000 } }
    const st = newEgressState()
    const send: EgressAction = { kind: 'deposit', recipient: A, amountSol: 0.001 }
    commitEgress(st, send, t0)
    commitEgress(st, send, t0 + 100)
    expect(checkEgress(st, policy, send, t0 + 200)).toMatchObject({ allow: false, code: 'VELOCITY_EXCEEDED' })
    expect(checkEgress(st, policy, send, t0 + 1200).allow).toBe(true) // window slid past both stamps
  })
})

describe('AuditLog', () => {
  it('sequences 1..n and records ALLOW without a code/detail', () => {
    const log = new AuditLog('buyer-1')
    const e1 = log.record({ kind: 'deposit', recipient: A, amountSol: 0.0005 }, { allow: true })
    const e2 = log.record({ kind: 'http', host: 'evil.example' }, { allow: false, code: 'HOST_NOT_ALLOWED', detail: 'not on allowlist' })
    expect([e1.seq, e2.seq]).toEqual([1, 2])
    expect(e1).toMatchObject({ agent: 'buyer-1', decision: 'ALLOW', action: `deposit 0.0005 SOL -> ${A}` })
    expect(e1.code).toBeUndefined()
    expect(e1.detail).toBeUndefined()
    expect(e2).toMatchObject({ decision: 'DENY', code: 'HOST_NOT_ALLOWED', detail: 'not on allowlist', action: 'http evil.example' })
    expect(log.entries).toHaveLength(2)
  })

  it('toJsonl emits one JSON object per line that round-trips via JSON.parse', () => {
    const log = new AuditLog('seller-1')
    log.record({ kind: 'transfer', recipient: B, amountSol: 0.1 }, { allow: true })
    log.record({ kind: 'deposit', recipient: B, amountSol: 2, reference: 'R' }, { allow: false, code: 'BUDGET_EXCEEDED', detail: 'over cap' })
    const lines = log.toJsonl().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => JSON.parse(l))).toEqual([...log.entries])
  })
})
