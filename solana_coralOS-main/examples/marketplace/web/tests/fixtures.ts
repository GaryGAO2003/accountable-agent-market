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

export const fixtureRounds: Round[] = [settledRound, biddingRound, refundedRound]
