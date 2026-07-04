import type { Feed, Round } from '../types'
import { RoundCard } from './RoundCard'
import { ReputationStrip } from './ReputationStrip'

/** The live market feed — a per-seller reputation strip, then the rounds newest-first. */
export function MarketView({ rounds, reputation }: { rounds: Round[]; reputation?: Feed['reputation'] }) {
  if (rounds.length === 0) {
    return <p className="empty" data-testid="empty">Waiting for the buyer to broadcast a WANT…</p>
  }
  const newestFirst = [...rounds].sort((a, b) => b.round - a.round)
  return (
    <div className="market" data-testid="market">
      <ReputationStrip reputation={reputation} />
      {newestFirst.map((r) => (
        <RoundCard key={r.round} round={r} />
      ))}
    </div>
  )
}
