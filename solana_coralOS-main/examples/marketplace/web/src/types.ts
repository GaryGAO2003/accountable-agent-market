// The feed server's API contract (mirrors marketplace-feed's Round). Kept here so the browser bundle
// never imports the node-side runtime/anchor/web3 code.

export interface RoundBid {
  by: string
  priceSol: number
  note?: string
}

export interface RoundEgressAudit {
  seq: number
  decision: 'ALLOW' | 'DENY'
  action: string
  code?: string
  detail: string
  by?: string
}

export type RoundStatus = 'bidding' | 'awarded' | 'deposited' | 'delivered' | 'verified' | 'challenged' | 'rejected' | 'verification_failed' | 'settled' | 'refunded' | 'slashed' | 'blocked'

export interface Round {
  round: number
  want?: { service: string; arg: string; budgetSol: number }
  bids: RoundBid[]
  declined: string[]
  award?: { to: string; reason?: string }
  escrow?: { reference: string; seller: string; amountSol: number; deadlineSecs: number }
  deposit?: { sig: string; buyer: string }
  bond?: { seller: string; holder: string; amountSol: number; sig: string }
  delivered?: { raw: string; data?: unknown }
  verification?: { ok: boolean; code: string; reason: string }
  challenge?: { by: string; reason: string; challenger?: string; bondSig?: string }
  challengeDecision?: { upheld: boolean; code: string; reason: string }
  release?: { sig: string }
  refunded?: boolean
  refund?: { sig: string }
  slash?: { sig: string; amountSol?: number; from?: string; to?: string; bond?: 'seller' | 'challenger' }
  /** An egress PEP refused an action for this round — no on-chain tx happened, so no sig/link exists. */
  egress?: { code: string; action: string; by?: string }
  egressAudits?: RoundEgressAudit[]
  status: RoundStatus
}

export interface Feed {
  session: string
  rounds: Round[]
  updatedAt: string
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`
