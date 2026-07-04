import { describe, it, expect } from 'vitest'
import {
  ReputationLedger, REP_WEIGHTS, formatReputation, parseReputation,
  type RepOutcome, type RepTier,
} from './reputation.js'

/** Drive a seller through a sequence of outcomes, returning the final standing. */
const feed = (led: ReputationLedger, seller: string, ...outcomes: RepOutcome[]) => {
  let last: { score: number; tier: RepTier } = { score: 0, tier: 'neutral' }
  for (const o of outcomes) last = led.update(seller, o)
  return last
}

describe('ReputationLedger - scoring weights', () => {
  for (const [outcome, weight] of Object.entries(REP_WEIGHTS) as [RepOutcome, number][]) {
    it(`${outcome} moves a fresh seller's score by ${weight}`, () => {
      expect(new ReputationLedger().update('s', outcome).score).toBe(weight)
    })
  }
  it('settled is the only positive weight; all three failure modes cost the same', () => {
    expect(REP_WEIGHTS.settled).toBeGreaterThan(0)
    expect(REP_WEIGHTS.refunded).toBe(REP_WEIGHTS.blocked)
    expect(REP_WEIGHTS.blocked).toBe(REP_WEIGHTS.verify_failed)
    expect(Math.abs(REP_WEIGHTS.refunded)).toBeGreaterThan(REP_WEIGHTS.settled) // one fraud outweighs one delivery
  })
})

describe('ReputationLedger - tier boundaries (defaults trust=2, flag=-3, both inclusive)', () => {
  const cases: { name: string; outcomes: RepOutcome[]; score: number; tier: RepTier }[] = [
    { name: 'exactly at trust', outcomes: ['settled'], score: 2, tier: 'trusted' },
    { name: 'one below trust', outcomes: ['settled', 'settled', 'refunded'], score: 1, tier: 'neutral' },
    { name: 'one above flag', outcomes: ['settled', 'settled', 'refunded', 'refunded'], score: -2, tier: 'neutral' },
    { name: 'exactly at flag', outcomes: ['refunded'], score: -3, tier: 'flagged' },
  ]
  for (const c of cases) {
    it(`score ${c.score} (${c.name}) -> ${c.tier}`, () => {
      const led = new ReputationLedger()
      const r = feed(led, 's', ...c.outcomes)
      expect(r).toEqual({ score: c.score, tier: c.tier })
      expect(led.score('s')).toBe(c.score)
      expect(led.tier('s')).toBe(c.tier)
    })
  }
})

describe('ReputationLedger - custom thresholds', () => {
  it('honors overridden trust/flag boundaries', () => {
    const led = new ReputationLedger({ trust: 4, flag: -6 })
    expect(feed(led, 's', 'settled').tier).toBe('neutral')  // +2, below trust=4
    expect(feed(led, 's', 'settled').tier).toBe('trusted')  // +4, exactly at trust
    expect(feed(led, 's', 'refunded').tier).toBe('neutral') //  1
    expect(feed(led, 's', 'refunded').tier).toBe('neutral') // -2
    expect(feed(led, 's', 'refunded').tier).toBe('neutral') // -5, above flag=-6
    expect(feed(led, 's', 'refunded').tier).toBe('flagged') // -8, below flag
  })
  it('a partial override keeps the other default', () => {
    const led = new ReputationLedger({ trust: 6 }) // flag stays -3
    expect(feed(led, 's', 'refunded').tier).toBe('flagged') // -3 at default flag
  })
})

describe('ReputationLedger - unknown seller', () => {
  it('scores 0 and reads neutral before any outcome', () => {
    const led = new ReputationLedger()
    expect(led.score('ghost')).toBe(0)
    expect(led.tier('ghost')).toBe('neutral')
    expect(led.entries).toEqual([])
  })
  it('stays neutral for an unrated seller even under a trust<=0 config (unrated != trusted)', () => {
    expect(new ReputationLedger({ trust: 0 }).tier('ghost')).toBe('neutral')
  })
})

describe('ReputationLedger - entries', () => {
  it('lists sellers in first-seen order, regardless of later activity', () => {
    const led = new ReputationLedger()
    led.update('c', 'settled')
    led.update('a', 'refunded')
    led.update('b', 'settled')
    led.update('a', 'settled') // 'a' active again, but was still seen 2nd
    expect(led.entries.map((e) => e.seller)).toEqual(['c', 'a', 'b'])
  })
  it('each entry carries its ordered outcome history and current standing', () => {
    const led = new ReputationLedger()
    led.update('a', 'settled')
    led.update('a', 'refunded')
    expect(led.entries[0]).toMatchObject({ seller: 'a', score: -1, tier: 'neutral', outcomes: ['settled', 'refunded'] })
  })
})

describe('ReputationLedger - a rogue seller decays to flagged', () => {
  it('settled(+2, trusted) -> refunded(-1, neutral) -> refunded(-4, flagged)', () => {
    const led = new ReputationLedger()
    expect(led.update('rogue', 'settled')).toEqual({ score: 2, tier: 'trusted' })
    expect(led.update('rogue', 'refunded')).toEqual({ score: -1, tier: 'neutral' })
    expect(led.update('rogue', 'refunded')).toEqual({ score: -4, tier: 'flagged' })
    expect(led.entries[0].outcomes).toEqual(['settled', 'refunded', 'refunded'])
  })
})

describe('formatReputation / parseReputation', () => {
  it('round-trips with and without a sig', () => {
    const withSig = { seller: 'sellerA', score: 5, tier: 'trusted' as const, outcome: 'settled' as const, round: 7, sig: '5xSig58base' }
    const noSig = { seller: 'sellerB', score: 1, tier: 'neutral' as const, outcome: 'refunded' as const, round: 8 }
    expect(parseReputation(formatReputation(withSig))).toEqual(withSig)
    expect(parseReputation(formatReputation(noSig))).toEqual(noSig)
  })
  it('round-trips a negative score (flagged sellers sit below zero)', () => {
    const u = { seller: 's', score: -3, tier: 'flagged' as const, outcome: 'verify_failed' as const, round: 2 }
    const line = formatReputation(u)
    expect(line).toContain('score=-3')
    expect(parseReputation(line)).toEqual(u)
  })
  it('tolerates the optional trailing sig token', () => {
    expect(parseReputation('REPUTATION seller=s score=0 tier=neutral outcome=blocked round=1 sig=abc123'))
      .toMatchObject({ sig: 'abc123' })
  })
  it('returns tier/outcome as raw strings (tolerates an unknown band)', () => {
    expect(parseReputation('REPUTATION seller=s score=0 tier=probation outcome=timeout round=1'))
      .toMatchObject({ tier: 'probation', outcome: 'timeout' })
  })
  it('returns null on other verbs', () => {
    expect(parseReputation('EGRESS_DENIED round=1 code=HOST_NOT_ALLOWED action=http detail=nope')).toBeNull()
    expect(parseReputation('RELEASED round=3 reference=R sig=xyz')).toBeNull()
    expect(parseReputation('')).toBeNull()
  })
  it('returns null when a required field is missing', () => {
    expect(parseReputation('REPUTATION seller=s tier=neutral outcome=settled round=1')).toBeNull() // no score
  })
})
