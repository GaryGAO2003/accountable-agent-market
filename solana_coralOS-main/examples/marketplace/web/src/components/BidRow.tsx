import type { RoundBid } from '../types'

/** L3 tell on a bid row: coral "frozen out" for a flagged seller, mint "✓ trusted" for a trusted one.
 *  Neutral renders nothing — so a rogue's later, flagged bids read as visibly dead-on-arrival. */
function RepChip({ tier }: { tier?: RoundBid['sellerTier'] }) {
  if (tier === 'flagged') return <span className="rep-chip rep-chip-flagged" data-testid="rep-chip">frozen out</span>
  if (tier === 'trusted') return <span className="rep-chip rep-chip-trusted" data-testid="rep-chip">✓ trusted</span>
  return null
}

export function BidRow({ bid, won }: { bid: RoundBid; won: boolean }) {
  return (
    <div className={`bid ${won ? 'bid-won' : ''}`} data-testid="bid" data-seller={bid.by}>
      <span className="bid-seller">{bid.by}</span>
      <span className="bid-price">{bid.priceSol} SOL</span>
      {bid.note && <span className="bid-note">{bid.note}</span>}
      <RepChip tier={bid.sellerTier} />
      {won && <span className="bid-tag">won</span>}
    </div>
  )
}

export function DeclinedRow({ seller }: { seller: string }) {
  return (
    <div className="bid bid-declined" data-testid="declined" data-seller={seller}>
      <span className="bid-seller">{seller}</span>
      <span className="bid-note">declined — not in inventory</span>
    </div>
  )
}
