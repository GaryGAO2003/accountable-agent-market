import type { Round } from '../src/types'

/** A settled round — premium wins on value over cheap; honest declined. Shapes match a real devnet run. */
export const settledRound: Round = {
  round: 1,
  want: { service: 'coingecko', arg: 'SOL-USDC', budgetSol: 0.001 },
  bids: [
    { by: 'seller-premium', priceSol: 0.0005, note: 'verified' },
    { by: 'seller-cheap', priceSol: 0.0002, note: 'undercut' },
  ],
  declined: ['seller-honest'],
  award: { to: 'seller-premium', reason: 'verified data worth the premium for this lookup' },
  escrow: { reference: 'DKQy', seller: '7jwB', amountSol: 0.0005, deadlineSecs: 600 },
  deposit: { sig: '5syzoWto3RjRYfLMCAkJ', buyer: '47Dp' },
  delivered: { raw: '{"coin":"solana","usd":72.33}', data: { coin: 'solana', usd: 72.33 } },
  verification: { ok: true, code: 'txline_fixtures_match', reason: 're-exec matched' },
  release: { sig: '3PMa9LBZn7VEMD1qZnmr' },
  status: 'settled',
}

/** A round still collecting bids. */
export const biddingRound: Round = {
  round: 2,
  want: { service: 'coingecko', arg: 'SOL-USDC', budgetSol: 0.001 },
  bids: [{ by: 'seller-cheap', priceSol: 0.0002 }],
  declined: [],
  status: 'bidding',
}

/** A refunded round — the winning seller never delivered, so the buyer reclaimed escrow on-chain. */
export const refundedRound: Round = {
  round: 3,
  want: { service: 'coingecko', arg: 'SOL-USDC', budgetSol: 0.001 },
  bids: [
    { by: 'seller-premium', priceSol: 0.0005, note: 'verified' },
    { by: 'seller-cheap', priceSol: 0.0002, note: 'undercut' },
  ],
  declined: ['seller-honest'],
  award: { to: 'seller-cheap', reason: 'cheapest bid for a simple lookup' },
  escrow: { reference: 'DKQy', seller: '7jwB', amountSol: 0.0002, deadlineSecs: 600 },
  deposit: { sig: '8kLmNpQr2sTuVwXy3zAb', buyer: '47Dp' },
  refunded: true,
  refund: { sig: '7RfNdK3mPq2sT8vXaZ9cBnW4hJ5uY6eD' },
  status: 'refunded',
}

/** A PEP-blocked round — the winner named a foreign payout wallet, so the buyer's egress fence refused
 *  the deposit. No deposit tx was ever sent: no deposit/release/refund sig, nothing settled on-chain. */
export const blockedRound: Round = {
  round: 4,
  want: { service: 'txline', arg: 'fixtures', budgetSol: 0.001 },
  bids: [
    { by: 'seller-hijack', priceSol: 0.0002, note: 'undercut' },
    { by: 'seller-honest', priceSol: 0.0007, note: 'verified' },
  ],
  declined: [],
  award: { to: 'seller-hijack', reason: 'lowest bid for a simple lookup' },
  escrow: { reference: 'HJK9', seller: 'F0reignWa11et', amountSol: 0.0002, deadlineSecs: 600 },
  egress: { code: 'RECIPIENT_NOT_ALLOWED', action: 'deposit', by: 'buyer-agent' },
  status: 'blocked',
}

/** L3 reputation trajectory (round 5) — the rogue wins on price while still unproven (its bid folds
 *  'neutral'), takes escrow, never delivers, and is refunded → the buyer flags it. Two DIFFERENT devnet
 *  txs land here: the on-chain refund (footer settlement link) and the SPL-Memo standing log (the rep
 *  `memo ↗` link) — the fixture that proves the memo is attributed to reputation, not settlement. */
export const repFlagRound: Round = {
  round: 5,
  want: { service: 'coingecko', arg: 'ETH-USDC', budgetSol: 0.001 },
  bids: [
    { by: 'seller-rogue', priceSol: 0.0002, note: 'undercut', sellerTier: 'neutral' },
  ],
  declined: ['seller-honest', 'seller-premium'],
  award: { to: 'seller-rogue', reason: 'lowest bid — rogue still unproven at award time' },
  escrow: { reference: 'RGX1', seller: '9xRgFraudWa11et', amountSol: 0.0002, deadlineSecs: 600 },
  deposit: { sig: '2abRogueDeposit5xY', buyer: '47Dp' },
  refunded: true,
  refund: { sig: '6RefundRogue5nQpZ8vW' },
  reputation: { seller: 'seller-rogue', score: -3, tier: 'flagged', outcome: 'refunded', sig: 'MemoRogueFlag1111devnet' },
  status: 'refunded',
}

/** The L3 money shot (round 6) — the now-flagged rogue bids again, cheapest of all, and is DROPPED
 *  ('frozen out' chip); the trusted honest seller wins despite a higher price and settles clean. */
export const frozenBidRound: Round = {
  round: 6,
  want: { service: 'coingecko', arg: 'SOL-USDC', budgetSol: 0.001 },
  bids: [
    { by: 'seller-honest', priceSol: 0.0006, note: 'verified', sellerTier: 'trusted' },
    { by: 'seller-rogue', priceSol: 0.0001, note: 'undercut', sellerTier: 'flagged' },
  ],
  declined: ['seller-premium'],
  award: { to: 'seller-honest', reason: 'seller-rogue is frozen out (flagged); awarding the trusted seller' },
  escrow: { reference: 'HON6', seller: '5hoNestWa11et', amountSol: 0.0006, deadlineSecs: 600 },
  deposit: { sig: 'DepHonest6aBcD', buyer: '47Dp' },
  delivered: { raw: '{"coin":"solana","usd":73.10}', data: { coin: 'solana', usd: 73.10 } },
  verification: { ok: true, code: 'txline_fixtures_match', reason: 're-exec matched' },
  release: { sig: 'RelHonest6eFgH' },
  reputation: { seller: 'seller-honest', score: 2, tier: 'trusted', outcome: 'settled', sig: 'MemoHonestTrust6devnet' },
  status: 'settled',
}

/** Per-seller standing as the feed server serves it (last update wins) — powers the reputation strip. */
export const reputationSummaryFixture: Record<string, { score: number; tier: string }> = {
  'seller-premium': { score: 4, tier: 'trusted' },
  'seller-honest': { score: 2, tier: 'trusted' },
  'seller-rogue': { score: -3, tier: 'flagged' },
}

export const fixtureRounds: Round[] = [settledRound, biddingRound, refundedRound, blockedRound, repFlagRound, frozenBidRound]
