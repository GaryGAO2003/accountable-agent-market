import type { Feed } from '../types'

/**
 * L3 at a glance — a compact, one-row per-seller standing strip above the rounds, built from the feed's
 * `reputation` field. This is the market's cross-round memory: coral = frozen out (flagged), mint = trusted.
 * Renders nothing until at least one seller has a standing.
 */
export function ReputationStrip({ reputation }: { reputation?: Feed['reputation'] }) {
  const sellers = reputation ? Object.entries(reputation) : []
  if (sellers.length === 0) return null
  return (
    <div className="rep-strip" data-testid="rep-strip">
      <span className="rep-strip-label">reputation</span>
      {sellers.map(([seller, { score, tier }]) => (
        <span key={seller} className="rep-seller" data-testid="rep-seller" data-seller={seller}>
          <span className="rep-seller-name">{seller}</span>
          <span className={`rep-tier rep-tier-${tier}`} data-testid="rep-tier">{tier}</span>
          <span className="rep-seller-score">score {score}</span>
        </span>
      ))}
    </div>
  )
}
