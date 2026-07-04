import { describe, it, expect } from 'vitest'
import {
  formatWant, parseWant, formatBid, parseBid, formatAward, parseAward,
  formatEscrowRequired, parseEscrowRequired, formatDeposited, parseDeposited,
  formatDelivered, parseDelivered, formatVerified, parseVerified,
  formatArbiterReview, parseArbiterReview, formatArbiterDecision, parseArbiterDecision,
  formatChallengeReview, parseChallengeReview,
  formatBondPosted, parseBondPosted, formatChallengeOpened, parseChallengeOpened,
  formatChallengeDecision, parseChallengeDecision, formatSlash, parseSlash,
  selectBids, pickCheapest, verb, messageRound,
  type Bid,
} from './protocol.js'

describe('WANT round-trip', () => {
  it('formats and parses', () => {
    const w = { round: 7, service: 'helius-risk', arg: '7jwB', budgetSol: 0.001 }
    expect(parseWant(formatWant(w))).toEqual(w)
  })
  it('rejects a non-WANT', () => {
    expect(parseWant('BID round=7 price=0.0003 by=x')).toBeNull()
  })
})

describe('BID round-trip', () => {
  it('formats and parses with a free-text note', () => {
    const b = { round: 7, priceSol: 0.0006, by: 'seller-premium', note: 'verified, fresh pull' }
    expect(parseBid(formatBid(b))).toEqual(b)
  })
  it('parses without a note', () => {
    expect(parseBid('BID round=3 price=0.0002 by=seller-cheap')).toEqual({
      round: 3, priceSol: 0.0002, by: 'seller-cheap',
    })
  })
})

describe('AWARD + ESCROW_REQUIRED round-trip', () => {
  it('AWARD', () => {
    expect(parseAward(formatAward(9, 'seller-cheap'))).toEqual({ round: 9, to: 'seller-cheap' })
  })
  it('AWARD round-trips the optional reason', () => {
    const msg = formatAward(9, 'seller-cheap', 'best value')
    expect(msg).toContain('reason="best value"')
    expect(parseAward(msg)).toEqual({ round: 9, to: 'seller-cheap', reason: 'best value' })
  })
  it('ESCROW_REQUIRED', () => {
    const t = { round: 9, reference: 'R3f', seller: 'SeLLeRwa11et', amountSol: 0.0006, deadlineSecs: 600, settlement: 'arbiter' as const }
    expect(parseEscrowRequired(formatEscrowRequired(t))).toEqual(t)
  })
  it('DEPOSITED', () => {
    const d = { round: 9, reference: 'R3f', buyer: 'BuYeRwa11et', sig: '5h2abc', settlement: 'arbiter' as const, vault: 'VaU1t', arbiter: 'ArB1t3r' }
    expect(parseDeposited(formatDeposited(d))).toEqual(d)
  })
})

describe('delivery verification round-trip', () => {
  it('DELIVERED carries the raw payload for buyer-side verification', () => {
    const raw = '{"service":"txline-fixtures","count":2}'
    const msg = formatDelivered({ round: 9, raw })
    expect(msg).toBe(`DELIVERED round=9 ${raw}`)
    expect(parseDelivered(msg)).toEqual({ round: 9, raw })
  })

  it('VERIFIED records objective re-exec evidence', () => {
    const msg = formatVerified({
      round: 9,
      ok: true,
      code: 'txline_fixtures_match',
      reason: 'fixtures snapshot matched',
    })
    expect(parseVerified(msg)).toEqual({
      round: 9,
      ok: true,
      code: 'txline_fixtures_match',
      reason: 'fixtures snapshot matched',
    })
  })

  it('VERIFICATION_FAILED records why release is blocked', () => {
    const msg = formatVerified({
      round: 9,
      ok: false,
      code: 'count_mismatch',
      reason: 'delivered count differs from re-exec',
    })
    expect(verb(msg)).toBe('VERIFICATION_FAILED')
    expect(parseVerified(msg)).toEqual({
      round: 9,
      ok: false,
      code: 'count_mismatch',
      reason: 'delivered count differs from re-exec',
    })
  })
})

describe('arbiter review round-trip', () => {
  it('ARBITER_REVIEW carries objective evidence for a third-party arbiter agent', () => {
    const review = {
      round: 9,
      service: 'txline',
      arg: 'edge 123',
      reference: 'Ref111',
      seller: 'Seller111',
      payer: 'Buyer111',
      challenger: 'Challenger111',
      raw: '{"service":"txline-edge","fixtureId":"123"}',
    }
    expect(parseArbiterReview(formatArbiterReview(review))).toEqual(review)
  })

  it('ARBITER_VERIFIED / ARBITER_REJECTED records the arbiter decision', () => {
    const ok = formatArbiterDecision({
      round: 9,
      ok: true,
      code: 'txline_edge_match',
      reason: 're-exec matched',
    })
    expect(verb(ok)).toBe('ARBITER_VERIFIED')
    expect(parseArbiterDecision(ok)).toEqual({
      round: 9,
      ok: true,
      code: 'txline_edge_match',
      reason: 're-exec matched',
    })

    const rejected = formatArbiterDecision({
      round: 10,
      ok: false,
      code: 'txline_count_mismatch',
      reason: 'delivered count differs from re-exec',
    })
    expect(verb(rejected)).toBe('ARBITER_REJECTED')
    expect(parseArbiterDecision(rejected)?.ok).toBe(false)
  })
})

describe('L1 accountability messages', () => {
  it('CHALLENGE_REVIEW carries delivery evidence for a separate challenger agent', () => {
    const review = {
      round: 4,
      service: 'txline',
      arg: 'fixtures',
      raw: '{"service":"txline-fixtures","count":13}',
    }
    const msg = formatChallengeReview(review)
    expect(verb(msg)).toBe('CHALLENGE_REVIEW')
    expect(parseChallengeReview(msg)).toEqual(review)
  })

  it('BOND_POSTED records the slashable seller bond proof', () => {
    const bond = {
      round: 4,
      seller: 'Seller111',
      holder: 'Arbiter111',
      amountSol: 0.0001,
      sig: 'BondSig111',
    }
    expect(parseBondPosted(formatBondPosted(bond))).toEqual(bond)
  })

  it('CHALLENGE_OPENED carries challenger evidence without breaking old messages', () => {
    const challenge = {
      round: 4,
      by: 'challenger-agent',
      reason: 'objective re-exec found bad data',
      challenger: 'Challenger111',
      bondSig: 'ChallengeBondSig',
    }
    const msg = formatChallengeOpened(challenge)
    expect(verb(msg)).toBe('CHALLENGE_OPENED')
    expect(parseChallengeOpened(msg)).toEqual(challenge)
  })

  it('CHALLENGE_UPHELD / CHALLENGE_REJECTED records the dispute outcome', () => {
    const upheld = formatChallengeDecision({
      round: 4,
      upheld: true,
      code: 'txline_count_mismatch',
      reason: 'seller count differed from re-exec',
    })
    expect(verb(upheld)).toBe('CHALLENGE_UPHELD')
    expect(parseChallengeDecision(upheld)).toEqual({
      round: 4,
      upheld: true,
      code: 'txline_count_mismatch',
      reason: 'seller count differed from re-exec',
    })

    const rejected = formatChallengeDecision({
      round: 5,
      upheld: false,
      code: 'txline_fixtures_match',
      reason: 'delivery matched',
    })
    expect(verb(rejected)).toBe('CHALLENGE_REJECTED')
    expect(parseChallengeDecision(rejected)?.upheld).toBe(false)
  })

  it('SLASHED / ARBITER_SLASHED carries the on-chain slash signature', () => {
    const slash = {
      round: 4,
      sig: 'SlashSig111',
      amountSol: 0.0001,
      from: 'Arbiter111',
      to: 'Buyer111',
      bond: 'seller' as const,
      settlement: 'transfer' as const,
      arbiter: true,
    }
    const msg = formatSlash(slash)
    expect(verb(msg)).toBe('ARBITER_SLASHED')
    expect(parseSlash(msg)).toEqual(slash)
  })
})

describe('selection', () => {
  const bids: Bid[] = [
    { round: 7, priceSol: 0.0006, by: 'premium' },
    { round: 7, priceSol: 0.0003, by: 'cheap' },
    { round: 6, priceSol: 0.0001, by: 'cheap' }, // different round - excluded
    { round: 7, priceSol: 0.0002, by: 'cheap' }, // cheap re-bids; last wins
  ]
  it('selectBids filters by round and dedupes by seller (last wins)', () => {
    const r7 = selectBids(bids, 7)
    expect(r7).toHaveLength(2)
    expect(r7.find((b) => b.by === 'cheap')?.priceSol).toBe(0.0002)
  })
  it('pickCheapest picks the lowest price', () => {
    expect(pickCheapest(selectBids(bids, 7))?.by).toBe('cheap')
  })
})

describe('helpers', () => {
  it('verb + messageRound', () => {
    expect(verb('WANT round=7 ...')).toBe('WANT')
    expect(messageRound('BID round=42 price=0.1 by=x')).toBe(42)
  })
})
