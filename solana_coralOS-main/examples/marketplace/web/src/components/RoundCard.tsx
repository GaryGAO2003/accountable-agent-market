import { explorerTx, type Round } from '../types'
import { StatusPill } from './StatusPill'
import { BidRow, DeclinedRow } from './BidRow'
import { SettlementBadge } from './SettlementBadge'
import { WorldCupPanel } from './WorldCupPanel'

/** One auction round: the need, the competing bids, the award + reasoning, and on-chain settlement. */
export function RoundCard({ round }: { round: Round }) {
  const winner = round.award?.to
  const latestAudit = round.egressAudits?.at(-1)
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

      {latestAudit && (
        <p className={`round-audit round-audit-${latestAudit.decision.toLowerCase()}`} data-testid="round-audit">
          PEP {latestAudit.decision}: {latestAudit.action}
          {latestAudit.code ? ` · ${latestAudit.code}` : ''}
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
        {round.status === 'blocked' || round.egress ? (
          // Our PEP stopped this round before any tx — no signature, no Explorer link, no funds moved.
          <div className="blocked-badge" data-testid="blocked">
            <span className="blocked-tag">🛡 PEP blocked</span>
            {round.egress?.code && <code className="blocked-code">{round.egress.code}</code>}
            <span className="blocked-note">blocked before deposit — no funds moved</span>
          </div>
        ) : (
          <>
            {round.deposit && <SettlementBadge label={`deposit ${round.escrow?.amountSol ?? ''} SOL`} sig={round.deposit.sig} />}
            {round.bond && <SettlementBadge label="bond" sig={round.bond.sig} />}
            {round.release && <SettlementBadge label="release" sig={round.release.sig} />}
            {round.refund?.sig
              ? <SettlementBadge label="refund" sig={round.refund.sig} className="settle-refund" />
              : round.refunded && <span className="settle settle-refund" data-testid="refund">refunded</span>}
            {round.slash && <SettlementBadge label="slash" sig={round.slash.sig} className="settle-slash" />}
          </>
        )}
      </footer>

      {round.reputation && (
        // L3 standing line — attributed to REPUTATION, not settlement. The memo link is a DIFFERENT devnet tx
        // (the SPL-Memo standing log), so it can appear even on a blocked round without implying money moved.
        <p className="rep-line" data-testid="reputation">
          <span className="rep-line-label">reputation:</span>{' '}
          <span className="rep-line-seller">{round.reputation.seller}</span> →{' '}
          <span className={`rep-tier rep-tier-${round.reputation.tier}`}>{round.reputation.tier}</span>{' '}
          (score {round.reputation.score})
          {round.reputation.sig && (
            <>
              {' '}
              <a className="rep-memo" data-testid="rep-memo" href={explorerTx(round.reputation.sig)} target="_blank" rel="noreferrer">
                memo ↗
              </a>
            </>
          )}
        </p>
      )}
    </article>
  )
}
