import type { Round } from '../types'
import { StatusPill } from './StatusPill'
import { BidRow, DeclinedRow } from './BidRow'
import { SettlementBadge } from './SettlementBadge'
import { WorldCupPanel } from './WorldCupPanel'

/** One auction round: the need, the competing bids, the award + reasoning, and on-chain settlement. */
export function RoundCard({ round }: { round: Round }) {
  const winner = round.award?.to
  return (
    <article className="round" data-testid="round" data-round={round.round}>
      <header className="round-head">
        <span className="round-n">#{round.round}</span>
        {round.want && (
          <span className="round-want">
            <strong>{round.want.service}</strong> {round.want.arg}
            <span className="round-budget">budget {round.want.budgetSol} SOL</span>
          </span>
        )}
        <StatusPill status={round.status} />
      </header>

      <div className="bids">
        {round.bids.map((b) => (
          <BidRow key={b.by} bid={b} won={b.by === winner} />
        ))}
        {round.declined.map((s) => (
          <DeclinedRow key={s} seller={s} />
        ))}
      </div>

      {round.award?.reason && (
        <p className="reason" data-testid="reason">
          <em>“{round.award.reason}”</em>
        </p>
      )}

      {round.delivered && (
        (round.delivered.data as { service?: string } | undefined)?.service === 'txline-edge'
          ? <WorldCupPanel edge={round.delivered.data as Parameters<typeof WorldCupPanel>[0]['edge']} />
          : <pre className="delivered" data-testid="delivered">{round.delivered.raw}</pre>
      )}

      {round.verification && (
        <p className={`verification ${round.verification.ok ? 'verification-ok' : 'verification-failed'}`} data-testid="verification">
          {round.verification.ok ? 'Verified' : 'Verification failed'}: {round.verification.reason}
        </p>
      )}

      {(round.bond || round.challenge || round.challengeDecision || round.slash) && (
        <div className="accountability" data-testid="accountability">
          {round.bond && <span>bond {round.bond.amountSol} SOL posted</span>}
          {round.challenge && <span>challenge by {round.challenge.by}: {round.challenge.reason}</span>}
          {round.challengeDecision && (
            <span>{round.challengeDecision.upheld ? 'challenge upheld' : 'challenge rejected'}: {round.challengeDecision.reason}</span>
          )}
          {round.slash && <span>{round.slash.bond ?? 'seller'} bond slashed{round.slash.amountSol ? ` (${round.slash.amountSol} SOL)` : ''}</span>}
        </div>
      )}

      <footer className="settle-row">
        {round.deposit && <SettlementBadge label={`deposit ${round.escrow?.amountSol ?? ''} SOL`} sig={round.deposit.sig} />}
        {round.bond && <SettlementBadge label="bond" sig={round.bond.sig} />}
        {round.release && <SettlementBadge label="release" sig={round.release.sig} />}
        {round.refund?.sig
          ? <SettlementBadge label="refund" sig={round.refund.sig} className="settle-refund" />
          : round.refunded && <span className="settle settle-refund" data-testid="refund">refunded</span>}
        {round.slash && <SettlementBadge label="slash" sig={round.slash.sig} className="settle-slash" />}
      </footer>
    </article>
  )
}
