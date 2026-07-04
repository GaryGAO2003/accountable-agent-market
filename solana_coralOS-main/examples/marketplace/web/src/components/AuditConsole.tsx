import type { Round, RoundEgressAudit } from '../types'

interface AuditRow extends RoundEgressAudit {
  round: number
}

function flattenAudits(rounds: Round[]): AuditRow[] {
  return rounds
    .flatMap((round) => (round.egressAudits ?? []).map((audit) => ({ ...audit, round: round.round })))
    .sort((a, b) => b.seq - a.seq || b.round - a.round)
}

/** Firewall-style live view of every Egress PEP verdict streamed through the CoralOS thread. */
export function AuditConsole({ rounds }: { rounds: Round[] }) {
  const audits = flattenAudits(rounds)
  const allowCount = audits.filter((a) => a.decision === 'ALLOW').length
  const denyCount = audits.filter((a) => a.decision === 'DENY').length

  return (
    <section className="audit-console" aria-labelledby="audit-title">
      <header className="audit-head">
        <div>
          <h2 id="audit-title">Realtime audit console</h2>
          <p>Buyer Egress PEP verdicts streamed from the market thread.</p>
        </div>
        <div className="audit-counts" aria-label={`${allowCount} allowed, ${denyCount} denied`}>
          <span className="audit-count audit-count-allow">ALLOW {allowCount}</span>
          <span className="audit-count audit-count-deny">DENY {denyCount}</span>
        </div>
      </header>

      {audits.length === 0 ? (
        <p className="audit-empty" data-testid="audit-empty">Waiting for EGRESS_AUDIT lines from the buyer…</p>
      ) : (
        <ol className="audit-stream" role="log" aria-live="polite" data-testid="audit-console">
          {audits.map((audit) => (
            <li className={`audit-row audit-row-${audit.decision.toLowerCase()}`} key={`${audit.round}-${audit.seq}`}>
              <span className="audit-seq">#{audit.seq}</span>
              <span className="audit-round">round {audit.round}</span>
              <strong className="audit-decision">{audit.decision}</strong>
              <span className="audit-action">{audit.action}</span>
              {audit.code && <code className="audit-code">{audit.code}</code>}
              <span className="audit-detail">{audit.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
