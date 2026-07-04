/**
 * foldRounds — turn a CoralOS session transcript into typed market Round objects.
 *
 * Pure and network-free, so it's fully unit-testable. Reuses the SAME parsers the agents use
 * (`@pay/agent-runtime`) — the market wire protocol has one source of truth.
 */
import {
  verb, messageRound, parseWant, parseBid, parseAward, parseEscrowRequired, parseDeposited,
  parseDelivered, parseVerified, parseArbiterDecision, parseEgressDenied,
} from '@pay/agent-runtime'

export interface RawMessage {
  sender: string
  text: string
}

export interface RoundBid {
  by: string
  priceSol: number
  note?: string
}

export type RoundStatus = 'bidding' | 'awarded' | 'deposited' | 'delivered' | 'verified' | 'verification_failed' | 'settled' | 'refunded' | 'blocked'

export interface Round {
  round: number
  want?: { service: string; arg: string; budgetSol: number }
  bids: RoundBid[]
  /** Sellers that were in the market but didn't bid (self-selected out) — needs the seller roster. */
  declined: string[]
  award?: { to: string; reason?: string }
  escrow?: { reference: string; seller: string; amountSol: number; deadlineSecs: number }
  deposit?: { sig: string; buyer: string }
  delivered?: { raw: string; data?: unknown }
  verification?: { ok: boolean; code: string; reason: string }
  release?: { sig: string }
  refunded?: boolean
  refund?: { sig: string }
  /** An egress PEP refused an action for this round — no on-chain tx happened, so no sig/link exists. Terminal. */
  egress?: { code: string; action: string; by?: string }
  status: RoundStatus
}

const tryJson = (s: string): unknown => {
  try { return JSON.parse(s) } catch { return undefined }
}

/** Optional `reason="…"` carried on an AWARD (the buyer's best-value justification). */
const awardReason = (text: string): string | undefined => text.match(/reason="([^"]*)"/)?.[1]

/**
 * Fold raw transcript messages into rounds (ascending). Pass the seller roster to compute which
 * sellers declined a round (self-selection) once its bidding has closed.
 */
export function foldRounds(messages: RawMessage[], sellers: string[] = []): Round[] {
  const byRound = new Map<number, Round>()
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
      if (!r.bids.some((b) => b.by === bid.by)) r.bids.push({ by: bid.by, priceSol: bid.priceSol, note: bid.note })
      continue
    }

    const award = parseAward(text)
    if (award) { const r = get(award.round); r.award = { to: award.to, reason: awardReason(text) }; if (r.status === 'bidding') r.status = 'awarded'; continue }

    const esc = parseEscrowRequired(text)
    if (esc) { get(esc.round).escrow = { reference: esc.reference, seller: esc.seller, amountSol: esc.amountSol, deadlineSecs: esc.deadlineSecs }; continue }

    const dep = parseDeposited(text)
    if (dep) { const r = get(dep.round); r.deposit = { sig: dep.sig, buyer: dep.buyer }; if (r.status !== 'settled' && r.status !== 'blocked') r.status = 'deposited'; continue }

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
      if (round.status !== 'settled' && round.status !== 'blocked') round.status = arbiterDecision.ok ? 'verified' : 'verification_failed'
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
