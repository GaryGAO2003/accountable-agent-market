import { describe, it, expect } from 'vitest'
import { foldRounds, type RawMessage } from './foldRounds.js'

const sellers = ['seller-cheap', 'seller-honest', 'seller-premium']

// A full happy-path round, verbatim from a real devnet run (sigs truncated).
const round1: RawMessage[] = [
  { sender: 'buyer-agent', text: 'WANT round=1 service=coingecko arg=SOL-USDC budget=0.001' },
  { sender: 'seller-premium', text: 'BID round=1 price=0.0005 by=seller-premium note=available' },
  { sender: 'seller-cheap', text: 'BID round=1 price=0.0002 by=seller-cheap note=available' },
  { sender: 'buyer-agent', text: 'AWARD round=1 to=seller-premium reason="verified data worth the premium"' },
  { sender: 'seller-premium', text: 'ESCROW_REQUIRED round=1 reference=DKQy seller=7jwB amount=0.0005 deadline=600' },
  { sender: 'buyer-agent', text: 'DEPOSITED round=1 reference=DKQy buyer=47Dp sig=5syz' },
  { sender: 'seller-premium', text: 'DELIVERED round=1 {"coin":"solana","usd":72.33}' },
  { sender: 'buyer-agent', text: 'VERIFIED round=1 ok=1 code=txline_fixtures_match reason="re-exec matched"' },
  { sender: 'buyer-agent', text: 'RELEASED round=1 sig=3PMa' },
]

describe('foldRounds', () => {
  it('folds a full round to settled with parsed fields', () => {
    const [r] = foldRounds(round1, sellers)
    expect(r.round).toBe(1)
    expect(r.want).toEqual({ service: 'coingecko', arg: 'SOL-USDC', budgetSol: 0.001 })
    expect(r.bids).toHaveLength(2)
    expect(r.award).toEqual({ to: 'seller-premium', reason: 'verified data worth the premium' })
    expect(r.escrow?.amountSol).toBe(0.0005)
    expect(r.deposit?.sig).toBe('5syz')
    expect(r.delivered?.data).toEqual({ coin: 'solana', usd: 72.33 })
    expect(r.verification).toEqual({ ok: true, code: 'txline_fixtures_match', reason: 're-exec matched' })
    expect(r.release?.sig).toBe('3PMa')
    expect(r.status).toBe('settled')
  })

  it('marks a delivered round as verified before release', () => {
    const [r] = foldRounds(round1.slice(0, 8), sellers)
    expect(r.verification?.ok).toBe(true)
    expect(r.status).toBe('verified')
  })

  it('marks failed verification as a blocked release', () => {
    const [r] = foldRounds([
      ...round1.slice(0, 7),
      { sender: 'buyer-agent', text: 'VERIFICATION_FAILED round=1 ok=0 code=txline_count_mismatch reason="delivered count differs from re-exec"' },
    ], sellers)
    expect(r.verification).toEqual({
      ok: false,
      code: 'txline_count_mismatch',
      reason: 'delivered count differs from re-exec',
    })
    expect(r.status).toBe('verification_failed')
  })

  it('folds arbiter decisions into the verification timeline', () => {
    const [r] = foldRounds([
      ...round1.slice(0, 7),
      { sender: 'arbiter-agent', text: 'ARBITER_REJECTED round=1 ok=0 code=txline_count_mismatch reason="delivered count differs from re-exec"' },
    ], sellers)
    expect(r.verification).toEqual({
      ok: false,
      code: 'txline_count_mismatch',
      reason: 'delivered count differs from re-exec',
    })
    expect(r.status).toBe('rejected')
  })

  it('treats ARBITER_RELEASED as a settled release without changing the wire protocol', () => {
    const msgs = round1.map((m) =>
      m.text.startsWith('RELEASED ')
        ? { ...m, text: m.text.replace('RELEASED ', 'ARBITER_RELEASED ') }
        : m,
    )
    const [r] = foldRounds(msgs, sellers)
    expect(r.release?.sig).toBe('3PMa')
    expect(r.status).toBe('settled')
  })

  it('folds L1 bond, challenge, decision, and slash evidence', () => {
    const [r] = foldRounds([
      ...round1.slice(0, 7),
      { sender: 'seller-premium', text: 'BOND_POSTED round=1 seller=Seller111 holder=Arbiter111 amount=0.0001 sig=BondSig111' },
      { sender: 'challenger-agent', text: 'CHALLENGE_OPENED round=1 by=challenger-agent reason="count differs" challenger=Challenger111 bondSig=ChallengerBondSig111' },
      { sender: 'arbiter-agent', text: 'CHALLENGE_UPHELD round=1 code=txline_count_mismatch reason="count differs"' },
      { sender: 'arbiter-agent', text: 'ARBITER_SLASHED round=1 sig=SlashSig111 amount=0.0001 from=Arbiter111 to=Challenger111 bond=seller settlement=transfer' },
    ], sellers)

    expect(r.bond).toEqual({ seller: 'Seller111', holder: 'Arbiter111', amountSol: 0.0001, sig: 'BondSig111' })
    expect(r.challenge).toEqual({
      by: 'challenger-agent',
      reason: 'count differs',
      challenger: 'Challenger111',
      bondSig: 'ChallengerBondSig111',
    })
    expect(r.challengeDecision).toEqual({ upheld: true, code: 'txline_count_mismatch', reason: 'count differs' })
    expect(r.slash).toEqual({
      sig: 'SlashSig111',
      amountSol: 0.0001,
      from: 'Arbiter111',
      to: 'Challenger111',
      bond: 'seller',
    })
    expect(r.status).toBe('slashed')
  })

  it('marks the non-bidding seller as declined (self-selection)', () => {
    const [r] = foldRounds(round1, sellers)
    expect(r.declined).toEqual(['seller-honest']) // only cheap + premium bid on coingecko
  })

  it('dedupes a seller that bids twice (last write kept by first-wins guard)', () => {
    const msgs: RawMessage[] = [
      { sender: 'buyer-agent', text: 'WANT round=2 service=coingecko arg=x budget=0.001' },
      { sender: 'seller-cheap', text: 'BID round=2 price=0.0002 by=seller-cheap' },
      { sender: 'seller-cheap', text: 'BID round=2 price=0.0003 by=seller-cheap' },
    ]
    expect(foldRounds(msgs).find((r) => r.round === 2)?.bids).toHaveLength(1)
  })

  it('handles a refund-after-deadline round (older transcript with no sig)', () => {
    const msgs: RawMessage[] = [
      { sender: 'buyer-agent', text: 'WANT round=3 service=coingecko arg=x budget=0.001' },
      { sender: 'seller-cheap', text: 'BID round=3 price=0.0002 by=seller-cheap' },
      { sender: 'buyer-agent', text: 'AWARD round=3 to=seller-cheap' },
      { sender: 'buyer-agent', text: 'REFUNDED round=3' },
    ]
    const r = foldRounds(msgs).find((r) => r.round === 3)
    expect(r?.status).toBe('refunded')
    expect(r?.refund).toBeUndefined()
  })

  it('captures the refund tx sig when the buyer reclaims escrow on-chain', () => {
    const msgs: RawMessage[] = [
      { sender: 'buyer-agent', text: 'WANT round=1 service=coingecko arg=x budget=0.001' },
      { sender: 'seller-cheap', text: 'BID round=1 price=0.0002 by=seller-cheap' },
      { sender: 'buyer-agent', text: 'AWARD round=1 to=seller-cheap' },
      { sender: 'buyer-agent', text: 'REFUNDED round=1 sig=FAKESIG123 settlement=direct' },
    ]
    const r = foldRounds(msgs).find((r) => r.round === 1)
    expect(r?.status).toBe('refunded')
    expect(r?.refund?.sig).toBe('FAKESIG123')
  })

  it('handles an arbiter refund-after-rejection round', () => {
    const msgs: RawMessage[] = [
      { sender: 'buyer-agent', text: 'WANT round=4 service=txline arg=fixtures budget=0.001' },
      { sender: 'seller-cheap', text: 'BID round=4 price=0.0002 by=seller-cheap' },
      { sender: 'buyer-agent', text: 'AWARD round=4 to=seller-cheap' },
      { sender: 'arbiter-agent', text: 'ARBITER_REJECTED round=4 ok=0 code=invalid_delivery_json reason="delivery is not parseable JSON"' },
      { sender: 'arbiter-agent', text: 'ARBITER_REFUNDED round=4 sig=9abc settlement=arbiter' },
    ]
    const round = foldRounds(msgs).find((r) => r.round === 4)!
    expect(round.refunded).toBe(true)
    expect(round.status).toBe('refunded')
  })

  it('folds an EGRESS_DENIED line to a terminal blocked round (no deposit, no settlement)', () => {
    const [r] = foldRounds([
      { sender: 'buyer-agent', text: 'WANT round=1 service=txline arg=fixtures budget=0.001' },
      { sender: 'seller-hijack', text: 'BID round=1 price=0.0002 by=seller-hijack note=undercut' },
      { sender: 'buyer-agent', text: 'AWARD round=1 to=seller-hijack reason="lowest bid"' },
      { sender: 'seller-hijack', text: 'ESCROW_REQUIRED round=1 reference=HJK9 seller=F0reignWa11et amount=0.0002 deadline=600' },
      { sender: 'buyer-agent', text: 'EGRESS_DENIED round=1 code=RECIPIENT_NOT_ALLOWED action=deposit detail=payout wallet F0reignWa11et not in allow-list' },
    ], sellers)
    expect(r.status).toBe('blocked')
    expect(r.egress).toEqual({ code: 'RECIPIENT_NOT_ALLOWED', action: 'deposit', by: 'buyer-agent' })
    // blocked is terminal: the buyer never deposited and nothing settled on-chain
    expect(r.deposit).toBeUndefined()
    expect(r.release).toBeUndefined()
    expect(r.refund).toBeUndefined()
    expect(r.refunded).toBeUndefined()
  })

  it('collects ALLOW and DENY egress audits without changing the round terminal state', () => {
    const [r1, r2] = foldRounds([
      ...round1,
      { sender: 'buyer-agent', text: 'EGRESS_AUDIT round=1 seq=1 decision=ALLOW action=deposit detail=deposit 0.0005 SOL -> 7jwB' },
      { sender: 'buyer-agent', text: 'WANT round=2 service=txline arg=fixtures budget=0.001' },
      { sender: 'buyer-agent', text: 'EGRESS_AUDIT round=2 seq=2 decision=DENY action=deposit code=RECIPIENT_NOT_ALLOWED detail=recipient bad wallet' },
      { sender: 'buyer-agent', text: 'EGRESS_DENIED round=2 code=RECIPIENT_NOT_ALLOWED action=deposit detail=recipient bad wallet' },
    ], sellers)
    expect(r1.status).toBe('settled')
    expect(r1.egressAudits).toEqual([
      { seq: 1, decision: 'ALLOW', action: 'deposit', detail: 'deposit 0.0005 SOL -> 7jwB', by: 'buyer-agent' },
    ])
    expect(r2.status).toBe('blocked')
    expect(r2.egressAudits).toEqual([
      {
        seq: 2,
        decision: 'DENY',
        action: 'deposit',
        code: 'RECIPIENT_NOT_ALLOWED',
        detail: 'recipient bad wallet',
        by: 'buyer-agent',
      },
    ])
  })

  it('keeps a round blocked even if a stray settlement verb arrives afterward', () => {
    const [r] = foldRounds([
      { sender: 'buyer-agent', text: 'WANT round=1 service=txline arg=fixtures budget=0.001' },
      { sender: 'buyer-agent', text: 'AWARD round=1 to=seller-hijack' },
      { sender: 'buyer-agent', text: 'EGRESS_DENIED round=1 code=RECIPIENT_NOT_ALLOWED action=deposit detail=foreign wallet' },
      { sender: 'buyer-agent', text: 'RELEASED round=1 sig=SHOULD_NOT_APPLY' },
    ], sellers)
    expect(r.status).toBe('blocked')
    expect(r.release).toBeUndefined()
  })

  it('separates interleaved rounds and sorts ascending', () => {
    const msgs: RawMessage[] = [
      { sender: 'b', text: 'WANT round=2 service=s arg=a budget=0.001' },
      { sender: 'b', text: 'WANT round=1 service=s arg=a budget=0.001' },
      { sender: 'c', text: 'BID round=1 price=0.0002 by=c' },
      { sender: 'c', text: 'BID round=2 price=0.0003 by=c' },
    ]
    const rounds = foldRounds(msgs)
    expect(rounds.map((r) => r.round)).toEqual([1, 2])
  })

  it('leaves an in-progress round in a non-settled status', () => {
    const r = foldRounds(round1.slice(0, 3), sellers)[0]
    expect(r.status).toBe('bidding')
    expect(r.declined).toEqual([]) // bidding still open → not yet declined
  })
})
