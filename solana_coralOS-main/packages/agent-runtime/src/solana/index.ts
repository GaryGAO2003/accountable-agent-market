// Solana pillar — devnet-guarded connection + Solana Pay settlement primitives.

export { assertDevnet, solanaConnection, DEVNET_RPC } from './connection.js'

export { generatePaymentUrl, verifyPayment, signTransfer, loadKeypairB58 } from './pay.js'
export type { PaymentUrl } from './pay.js'

// On-chain reputation trail - append-only SPL Memo log lines (a log, not a state machine).
export { buildMemoIx, sendMemo, MEMO_PROGRAM_ID } from './memo.js'
