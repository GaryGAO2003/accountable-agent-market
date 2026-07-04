import { explorerTx } from '../types'

/** A settlement step with a clickable devnet Explorer link for its signature. */
export function SettlementBadge({ label, sig, className }: { label: string; sig: string; className?: string }) {
  return (
    <a
      className={className ? `settle ${className}` : 'settle'}
      data-testid="settle"
      href={explorerTx(sig)}
      target="_blank"
      rel="noreferrer"
    >
      {label} ↗
    </a>
  )
}
