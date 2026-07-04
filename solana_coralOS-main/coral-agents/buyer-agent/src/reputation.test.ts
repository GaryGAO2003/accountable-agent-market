/**
 * L3 reputation - buyer wiring (R2). Exercises the exact market-layer behaviour the buyer loop composes
 * from the runtime ledger (`@pay/agent-runtime`, R1):
 *   - partitionFlagged / frozenOutLine: the one-way freeze - a flagged seller is dropped from the pool so
 *     it can never be re-awarded (and an all-flagged pool yields no award).
 *   - makeRecordOnce: exactly one ledger update + one REPUTATION thread line per round (first terminal
 *     outcome wins), the on-chain memo sig round-tripping when it lands and being omitted when it fails.
 * The ledger's own scoring/tier math is pinned upstream (market/reputation.test.ts); this proves the wiring.
 */
import { describe, it, expect, vi } from 'vitest'
import { ReputationLedger, parseReputation, type Bid } from '@pay/agent-runtime'
import { partitionFlagged, frozenOutLine, makeRecordOnce, type RecordOnceDeps } from './reputation.js'

const bid = (by: string, priceSol = 0.001, round = 1): Bid => ({ round, priceSol, by })

/** Faithful stand-in for the buyer's freeze + award gate: drop flagged bids, award only if any remain. */
function freeze(led: ReputationLedger, round: number, pool: Bid[]) {
  const { active, frozen } = partitionFlagged(pool, (b) => led.tier(b.by) === 'flagged')
  const frozenLines = frozen.map((b) => frozenOutLine(round, b.by, led.score(b.by)))
  return { eligible: active, frozenLines, noAward: active.length === 0 }
}

/** Recorder deps with vi.fn side effects; overrides let a test flip memo on/off or make the write throw. */
function deps(over: Partial<RecordOnceDeps> = {}) {
  const sent: string[] = []
  const logs: string[] = []
  const writeMemo = vi.fn(async () => 'MEMOSIG1111')
  const base: RecordOnceDeps = {
    ledger: new ReputationLedger(), round: 1, seller: 'rogue', memo: true,
    writeMemo, sendThread: async (l) => { sent.push(l) }, log: (l) => { logs.push(l) },
  }
  const d = { ...base, ...over }
  return { d, sent, logs, writeMemo: d.writeMemo as ReturnType<typeof vi.fn> }
}

describe('partitionFlagged - the L3 freeze (flagged sellers dropped from the pool)', () => {
  it('(a) excludes a flagged seller and awards from the rest', () => {
    const led = new ReputationLedger()
    led.update('rogue', 'refunded') // -3 -> flagged (default flag boundary)
    const { eligible, frozenLines, noAward } = freeze(led, 3, [bid('rogue'), bid('honest')])
    expect(eligible.map((b) => b.by)).toEqual(['honest']) // pickWinner only ever sees non-flagged bids
    expect(noAward).toBe(false)
    expect(frozenLines).toEqual(['[rep] round 3: rogue frozen out (score=-3, flagged) - bid ignored'])
  })

  it('(a) an all-flagged pool yields no award', () => {
    const led = new ReputationLedger()
    led.update('r1', 'refunded')     // -3 -> flagged
    led.update('r2', 'verify_failed') // -3 -> flagged
    const { eligible, noAward } = freeze(led, 4, [bid('r1'), bid('r2')])
    expect(eligible).toEqual([])
    expect(noAward).toBe(true) // -> loop logs NO_SELLERS (all bidders flagged) and skips the round
  })

  it('keeps a neutral/trusted seller in the pool (freeze targets flagged only)', () => {
    const led = new ReputationLedger()
    led.update('star', 'settled') // +2 -> trusted
    const { eligible, frozenLines } = freeze(led, 1, [bid('star'), bid('newcomer')])
    expect(eligible.map((b) => b.by)).toEqual(['star', 'newcomer']) // trusted + unrated(neutral) both eligible
    expect(frozenLines).toEqual([])
  })
})

describe('makeRecordOnce - exactly one reputation update per round', () => {
  it('(b) a second call in the same round is a no-op: one ledger update, one thread line', async () => {
    const { d, sent, logs, writeMemo } = deps()
    const recordOnce = makeRecordOnce(d)

    await recordOnce('settled')  // +2 -> trusted, recorded
    await recordOnce('refunded') // would be -3, but the round already recorded: no-op

    expect(d.ledger.score('rogue')).toBe(2) // only the FIRST outcome folded in
    expect(d.ledger.tier('rogue')).toBe('trusted')
    expect(sent).toHaveLength(1)             // one REPUTATION line on the thread
    expect(writeMemo).toHaveBeenCalledTimes(1)
    expect(parseReputation(sent[0])).toMatchObject({ seller: 'rogue', score: 2, tier: 'trusted', outcome: 'settled', round: 1 })
    expect(logs).toContain('[rep] round 1: rogue -> trusted (score 2) outcome=settled')
  })

  it('(c) the thread line round-trips via parseReputation and carries the memo sig when the write lands', async () => {
    const { d, sent, writeMemo } = deps({ seller: 'sellerA', round: 7, writeMemo: vi.fn(async () => 'SIG5xBase58') })
    await makeRecordOnce(d)('settled')

    expect(writeMemo).toHaveBeenCalledOnce()
    // the memo is written WITHOUT a sig (it can't know its own signature yet), then the thread line carries it
    expect((writeMemo.mock.calls[0][0] as string)).not.toContain('sig=')
    expect(parseReputation(sent[0])).toEqual({ seller: 'sellerA', score: 2, tier: 'trusted', outcome: 'settled', round: 7, sig: 'SIG5xBase58' })
  })

  it('(c) degrades to a thread-only line (no sig) when the memo write throws', async () => {
    const { d, sent, logs, writeMemo } = deps({ writeMemo: vi.fn(async () => { throw new Error('rpc down') }) })
    await makeRecordOnce(d)('verify_failed') // -3 -> flagged

    expect(writeMemo).toHaveBeenCalledOnce()
    expect(logs).toContain('[rep] memo write failed - thread-only')
    const parsed = parseReputation(sent[0])!
    expect(parsed.sig).toBeUndefined()                 // no sig when the anchor failed
    expect(parsed).toMatchObject({ score: -3, tier: 'flagged', outcome: 'verify_failed' })
    expect(d.ledger.tier('rogue')).toBe('flagged')     // still recorded in the ledger + thread despite the failure
  })

  it('skips the on-chain memo entirely when REP_MEMO is off (no write, no sig)', async () => {
    const { d, sent, writeMemo } = deps({ memo: false })
    await makeRecordOnce(d)('settled')

    expect(writeMemo).not.toHaveBeenCalled()
    expect(parseReputation(sent[0])!.sig).toBeUndefined()
  })
})

describe('rogue trajectory (L1 refund -> L3 flag -> frozen out next round)', () => {
  it('(d) a ghost round refunds to -3/flagged, then the rogue bid is dropped the next round', async () => {
    const led = new ReputationLedger()
    const sent: string[] = []
    const log = (_: string) => {}

    // Round 1: rogue wins, never delivers; the deadline refund records refunded (-3) -> flagged.
    await makeRecordOnce({
      ledger: led, round: 1, seller: 'rogue', memo: false,
      writeMemo: async () => '', sendThread: async (l) => { sent.push(l) }, log,
    })('refunded')
    expect(led.tier('rogue')).toBe('flagged')
    expect(parseReputation(sent[0])).toMatchObject({ seller: 'rogue', tier: 'flagged', outcome: 'refunded', round: 1 })

    // Round 2: rogue bids again, but the freeze drops it before pickWinner ever sees it.
    const { eligible, frozenLines } = freeze(led, 2, [bid('rogue', 0.001, 2), bid('honest', 0.002, 2)])
    expect(eligible.map((b) => b.by)).toEqual(['honest'])
    expect(frozenLines).toEqual(['[rep] round 2: rogue frozen out (score=-3, flagged) - bid ignored'])
  })
})
