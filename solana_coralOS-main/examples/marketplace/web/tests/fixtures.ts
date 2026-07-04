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

/** A challenged bad-delivery round — arbiter upholds the challenge and slashes the seller bond. */
export const slashedRound: Round = {
  round: 4,
  want: { service: 'txline', arg: 'fixtures', budgetSol: 0.001 },
  bids: [{ by: 'seller-cheap', priceSol: 0.0003, note: 'low price' }],
  declined: ['seller-honest', 'seller-premium'],
  award: { to: 'seller-cheap', reason: 'cheapest available' },
  escrow: { reference: 'Ref111', seller: 'Seller111', amountSol: 0.0003, deadlineSecs: 600 },
  deposit: { sig: 'DepositSig111', buyer: 'Buyer111' },
  bond: { seller: 'Seller111', holder: 'Arbiter111', amountSol: 0.0001, sig: 'BondSig111' },
  delivered: { raw: '{"service":"txline-fixtures","count":999}', data: { service: 'txline-fixtures', count: 999 } },
  verification: { ok: false, code: 'txline_count_mismatch', reason: 'delivered count differs from re-exec' },
  challenge: { by: 'buyer-agent', reason: 'delivered count differs from re-exec' },
  challengeDecision: { upheld: true, code: 'txline_count_mismatch', reason: 'delivered count differs from re-exec' },
  slash: { sig: 'SlashSig111', amountSol: 0.0001, from: 'Arbiter111', to: 'Buyer111', bond: 'seller' },
  status: 'slashed',
}

export const fixtureRounds: Round[] = [settledRound, biddingRound, refundedRound, slashedRound]
