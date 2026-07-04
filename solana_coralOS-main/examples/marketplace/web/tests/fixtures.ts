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
  egressAudits: [
    { seq: 1, decision: 'ALLOW', action: 'deposit', detail: 'deposit 0.0005 SOL -> 7jwB', by: 'buyer-agent' },
    { seq: 2, decision: 'ALLOW', action: 'release', detail: 'release 0.0005 SOL -> 7jwB', by: 'buyer-agent' },
  ],
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
  egressAudits: [
    {
      seq: 3,
      decision: 'DENY',
      action: 'deposit',
      code: 'RECIPIENT_NOT_ALLOWED',
      detail: 'recipient F0reignWa11et is not an approved payout wallet',
      by: 'buyer-agent',
    },
  ],
  egress: { code: 'RECIPIENT_NOT_ALLOWED', action: 'deposit', by: 'buyer-agent' },
  status: 'blocked',
}

export const slashedRound: Round = {
  round: 5,
  want: { service: 'txline', arg: 'fixtures', budgetSol: 0.001 },
  bids: [
    { by: 'seller-honest', priceSol: 0.0007, note: 'verified' },
    { by: 'seller-cheap', priceSol: 0.0004, note: 'cheap' },
  ],
  declined: [],
  award: { to: 'seller-cheap', reason: 'lowest bid with acceptable terms' },
  escrow: { reference: 'L1REF', seller: 'Seller111', amountSol: 0.0004, deadlineSecs: 600 },
  deposit: { sig: 'DepositSigL1', buyer: 'Buyer111' },
  bond: { seller: 'Seller111', holder: 'Arbiter111', amountSol: 0.0001, sig: 'SellerBondSig111' },
  delivered: { raw: '{"service":"txline-fixtures","count":9}', data: { service: 'txline-fixtures', count: 9 } },
  verification: { ok: false, code: 'txline_count_mismatch', reason: 'count differs' },
  challenge: {
    by: 'challenger-agent',
    reason: 'count differs',
    challenger: 'Challenger111',
    bondSig: 'ChallengerBondSig111',
  },
  challengeDecision: { upheld: true, code: 'txline_count_mismatch', reason: 'count differs' },
  slash: { sig: 'SlashSig111', amountSol: 0.0001, from: 'Arbiter111', to: 'Challenger111', bond: 'seller' },
  status: 'slashed',
}

export const fixtureRounds: Round[] = [settledRound, biddingRound, refundedRound, blockedRound, slashedRound]
