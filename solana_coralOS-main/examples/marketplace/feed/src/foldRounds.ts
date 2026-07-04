/**
 * foldRounds — turn a CoralOS session transcript into typed market Round objects.
 *
 * Pure and network-free, so it's fully unit-testable. Reuses the SAME parsers the agents use
 * (`@pay/agent-runtime`) — the market wire protocol has one source of truth.
 */
import {
  verb, messageRound, parseWant, parseBid, parseAward, parseEscrowRequired, parseDeposited,
  parseDelivered, parseVerified, parseArbiterDecision, parseBondPosted, parseChallengeOpened,
  parseChallengeDecision, parseSlash, parseEgressDenied,
  parseEgressAudit, parseReputation,
} from '@pay/agent-runtime'

export interface RawMessage {
  sender: string
  text: string
}

export interface RoundBid {
  by: string
  priceSol: number
  note?: string
  /** L3: the seller's reputation tier AT THE MOMENT THIS BID FOLDED. A bid placed before its seller was
   *  flagged reads 'neutral'; one placed after reads 'flagged' — an honest timeline. Defaults 'neutral'. */
  sellerTier?: 'trusted' | 'neutral' | 'flagged'
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
  /** Sellers that were in the market but didn't bid (self-selected out) — needs the seller roster. */
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
  /** An egress PEP refused an action for this round — no on-chain tx happened, so no sig/link exists. Terminal. */
  egress?: { code: string; action: string; by?: string }
  /** L3: the seller-standing change the buyer emitted for this round. An annotation ONLY — it never changes
   *  `status`. `sig`, when present, is a REAL devnet SPL-Memo tx anchoring the change (a memo trail). */
  reputation?: { seller: string; score: number; tier: string; outcome: string; sig?: string }
  /** Every PEP verdict the buyer streamed into the thread, including ALLOWs that later produced txs. */
  egressAudits?: RoundEgressAudit[]
  status: RoundStatus
}

const tryJson = (s: string): unknown => {
  try { return JSON.parse(s) } catch { return undefined }
}

/** Optional `reason="…"` carried on an AWARD (the buyer's best-value justification). */
const awardReason = (text: string): string | undefined => text.match(/reason="([^"]*)"/)?.[1]

/** Narrow the parser's loose tier string to the bid's tier union; anything unknown/absent → 'neutral'. */
const asTier = (t: string | undefined): NonNullable<RoundBid['sellerTier']> =>
  t === 'trusted' || t === 'flagged' ? t : 'neutral'

/**
 * Fold raw transcript messages into rounds (ascending). Pass the seller roster to compute which
 * sellers declined a round (self-selection) once its bidding has closed.
 */
export function foldRounds(messages: RawMessage[], sellers: string[] = []): Round[] {
  const byRound = new Map<number, Round>()
  const tierBySeller = new Map<string, string>() // L3 running standing, folded chronologically
  const get = (r: number): Round => {
    let round = byRound.get(r)
    if (!round) {
      round = { round: r, bids: [], declined: [], status: 'bidding' }
      byRound.set(r, round)
    }
    return round
  }

  for (const m of messages) {
    const text = m.text.trim()

    const want = parseWant(text)
    if (want) { get(want.round).want = { service: want.service, arg: want.arg, budgetSol: want.budgetSol }; continue }

    const bid = parseBid(text)
    if (bid) {
      const r = get(bid.round)
      if (!r.bids.some((b) => b.by === bid.by)) r.bids.push({ by: bid.by, priceSol: bid.priceSol, note: bid.note, sellerTier: asTier(tierBySeller.get(bid.by)) })
      continue
    }

    const award = parseAward(text)
    if (award) { const r = get(award.round); r.award = { to: award.to, reason: awardReason(text) }; if (r.status === 'bidding') r.status = 'awarded'; continue }

    const esc = parseEscrowRequired(text)
    if (esc) { get(esc.round).escrow = { reference: esc.reference, seller: esc.seller, amountSol: esc.amountSol, deadlineSecs: esc.deadlineSecs }; continue }

    const dep = parseDeposited(text)
    if (dep) { const r = get(dep.round); r.deposit = { sig: dep.sig, buyer: dep.buyer }; if (r.status !== 'settled' && r.status !== 'blocked') r.status = 'deposited'; continue }

    const bond = parseBondPosted(text)
    if (bond) { get(bond.round).bond = { seller: bond.seller, holder: bond.holder, amountSol: bond.amountSol, sig: bond.sig }; continue }

    const delivered = parseDelivered(text)
    if (delivered) {
      const round = get(delivered.round)
      const raw = delivered.raw
      round.delivered = { raw, data: tryJson(raw) }
      if (round.status !== 'settled' && round.status !== 'blocked') round.status = 'delivered'
      continue
    }

    const verified = parseVerified(text)
    if (verified) {
      const round = get(verified.round)
      round.verification = { ok: verified.ok, code: verified.code, reason: verified.reason }
      if (round.status !== 'settled' && round.status !== 'blocked') round.status = verified.ok ? 'verified' : 'verification_failed'
      continue
    }

    const arbiterDecision = parseArbiterDecision(text)
    if (arbiterDecision) {
      const round = get(arbiterDecision.round)
      round.verification = { ok: arbiterDecision.ok, code: arbiterDecision.code, reason: arbiterDecision.reason }
      if (round.status !== 'settled' && round.status !== 'blocked') round.status = arbiterDecision.ok ? 'verified' : 'rejected'
      continue
    }

    const challenge = parseChallengeOpened(text)
    if (challenge) {
      const round = get(challenge.round)
      round.challenge = {
        by: challenge.by,
        reason: challenge.reason,
        ...(challenge.challenger ? { challenger: challenge.challenger } : {}),
        ...(challenge.bondSig ? { bondSig: challenge.bondSig } : {}),
      }
      if (round.status !== 'settled' && round.status !== 'blocked') round.status = 'challenged'
      continue
    }

    const challengeDecision = parseChallengeDecision(text)
    if (challengeDecision) {
      const round = get(challengeDecision.round)
      round.challengeDecision = { upheld: challengeDecision.upheld, code: challengeDecision.code, reason: challengeDecision.reason }
      if (round.status !== 'settled' && round.status !== 'blocked') round.status = challengeDecision.upheld ? 'rejected' : 'verified'
      continue
    }

    const slash = parseSlash(text)
    if (slash) {
      const round = get(slash.round)
      round.slash = {
        sig: slash.sig,
        ...(slash.amountSol == null ? {} : { amountSol: slash.amountSol }),
        ...(slash.from ? { from: slash.from } : {}),
        ...(slash.to ? { to: slash.to } : {}),
        ...(slash.bond ? { bond: slash.bond } : {}),
      }
      if (round.status !== 'blocked') round.status = 'slashed'
      continue
    }

    const audit = parseEgressAudit(text)
    if (audit) {
      const round = get(audit.round)
      round.egressAudits = round.egressAudits ?? []
      round.egressAudits.push({
        seq: audit.seq,
        decision: audit.decision,
        action: audit.action,
        ...(audit.code ? { code: audit.code } : {}),
        detail: audit.detail,
        by: m.sender,
      })
      continue
    }

    // Egress PEP refusal (frozen wire line): the buyer's code-enforced fence stopped an action before
    // it left the agent. No on-chain tx happened, so 'blocked' is terminal — later verbs can't settle it.
    const egress = parseEgressDenied(text)
    if (egress) {
      const round = get(egress.round)
      round.egress = { code: egress.code, action: egress.action, by: m.sender }
      round.status = 'blocked'
      continue
    }

    // L3 reputation (annotation, NOT a settlement state): the buyer emits one standing update per round at
    // its first terminal outcome. Update the running tier (so LATER bids fold flagged) and stamp the round;
    // deliberately leave round.status untouched.
    const rep = parseReputation(text)
    if (rep) {
      tierBySeller.set(rep.seller, rep.tier)
      get(rep.round).reputation = { seller: rep.seller, score: rep.score, tier: rep.tier, outcome: rep.outcome, ...(rep.sig ? { sig: rep.sig } : {}) }
      continue
    }

    const v = verb(text)
    const r = messageRound(text)
    if ((v === 'RELEASED' || v === 'ARBITER_RELEASED') && r != null) {
      const round = get(r)
      if (round.status !== 'blocked') { // a blocked round never settles on-chain
        const sig = text.match(/sig=(\S+)/)?.[1]
        if (sig) round.release = { sig }
        round.status = 'settled'
      }
    } else if ((v === 'REFUNDED' || v === 'ARBITER_REFUNDED') && r != null) {
      const round = get(r)
      if (round.status !== 'blocked') {
        const sig = text.match(/sig=(\S+)/)?.[1]
        if (sig) round.refund = { sig }
        round.refunded = true
        round.status = 'refunded'
      }
    }
  }

  const rounds = [...byRound.values()].sort((a, b) => a.round - b.round)
  // Sellers who were in the roster but didn't bid on a round whose bidding has closed.
  for (const round of rounds) {
    if (round.status === 'bidding') continue
    round.declined = sellers.filter((s) => !round.bids.some((b) => b.by === s))
  }
  return rounds
}

/**
 * L3: fold rounds into a per-seller standing table (last reputation update per seller wins) — the shape
 * server.ts serves as the feed's `reputation` field, and the web strip renders. Order-independent: it
 * sorts by round ascending so "last wins" means chronologically last regardless of input order.
 */
export function reputationSummary(rounds: Round[]): Record<string, { score: number; tier: string }> {
  const summary: Record<string, { score: number; tier: string }> = {}
  for (const round of [...rounds].sort((a, b) => a.round - b.round)) {
    if (round.reputation) summary[round.reputation.seller] = { score: round.reputation.score, tier: round.reputation.tier }
  }
  return summary
}
