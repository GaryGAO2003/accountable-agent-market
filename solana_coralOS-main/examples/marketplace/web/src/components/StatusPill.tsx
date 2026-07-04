import type { RoundStatus } from '../types'

const LABEL: Record<RoundStatus, string> = {
  bidding: 'bidding',
  awarded: 'awarded',
  deposited: 'in escrow',
  delivered: 'delivered',
  verified: 'verified',
  verification_failed: 'verify failed',
  settled: 'settled',
  refunded: 'refunded',
  blocked: 'blocked',
}

export function StatusPill({ status }: { status: RoundStatus }) {
  return <span className={`pill pill-${status}`} data-testid="status">{LABEL[status]}</span>
}
