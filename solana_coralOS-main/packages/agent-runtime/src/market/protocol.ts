/**
 * Market protocol - the wire format for the open marketplace, as pure (network-free) functions so it
 * can be fully unit-tested. Agents format/parse these strings and route them over CoralOS threads
 * (https://docs.coralos.ai/concepts/threads); settlement happens through the escrow contract. Every
 * message carries a `round` to correlate the many messages flowing through one shared thread — Coral
 * moves opaque strings, so this `round` tag (not Coral) is what pairs a reply to its request.
 *
 *   WANT   round=<n> service=<name> arg=<token> budget=<sol>     buyer  -> market, @sellers
 *   BID    round=<n> price=<sol> by=<seller> [note=<free text>]  seller -> market (self-selects)
 *   AWARD  round=<n> to=<seller>                                 buyer  -> market, @winner
 *   ESCROW_REQUIRED round=<n> reference=<R> seller=<addr> amount=<sol> deadline=<secs>  seller -> buyer
 *   DEPOSITED round=<n> reference=<R> buyer=<addr> sig=<sig>     buyer  -> seller
 *   DELIVERED round=<n> <json>                                  seller -> buyer
 *   VERIFIED round=<n> ok=1 code=<code> reason="<why>"           buyer  -> market
 *   VERIFICATION_FAILED round=<n> ok=0 code=<code> reason="<why>" buyer -> market
 *   BOND_POSTED round=<n> seller=<addr> holder=<addr> amount=<sol> sig=<sig>
 *   CHALLENGE_REVIEW round=<n> service=<name> arg="<arg>" delivery=<json>
 *   CHALLENGE_OPENED round=<n> by=<agent> reason="<why>" [challenger=<addr>] [bondSig=<sig>]
 *   ARBITER_REVIEW round=<n> service=<name> arg="<arg>" reference=<R> seller=<addr> payer=<addr> [challenger=<addr>] delivery=<json>
 *   ARBITER_VERIFIED / ARBITER_REJECTED round=<n> ok=<1|0> code=<code> reason="<why>"
 *   CHALLENGE_UPHELD / CHALLENGE_REJECTED round=<n> code=<code> reason="<why>"
 *   SLASHED / ARBITER_SLASHED round=<n> sig=<sig> amount=<sol> from=<addr> to=<addr> [bond=seller|challenger]
 *   (then RELEASED / REFUNDED reuse the round tag)
 *   EGRESS_AUDIT round=<n> seq=<n> decision=<ALLOW|DENY> action=<deposit|release|refund|http> [code=<CODE>] detail=<free text>
 *   EGRESS_DENIED round=<n> code=<CODE> action=<deposit|release|refund|http> detail=<free text>  agent -> market/dashboard
 */
import type { ReasonCode } from './egress.js'

export interface Want {
  round: number
  service: string
  arg: string
  budgetSol: number
}

export interface Bid {
  round: number
  priceSol: number
  by: string
  note?: string
}

export interface EscrowTerms {
  round: number
  reference: string
  /** The seller's receive wallet (base58) - the buyer deposits to escrow naming this seller. */
  seller: string
  amountSol: number
  deadlineSecs: number
  /** Settlement rail requested by the seller. `arbiter` is the CoralOS default; `direct` is legacy. */
  settlement?: 'direct' | 'arbiter'
}

export interface Deposited {
  round: number
  reference: string
  /** The buyer's wallet (base58) - the seller derives the escrow PDA from (buyer, reference). */
  buyer: string
  sig: string
  /** Arbiter vault PDA, present when settlement='arbiter'. This is the escrow account's buyer. */
  vault?: string
  settlement?: 'direct' | 'arbiter'
  arbiter?: string
}

export interface Delivered {
  round: number
  raw: string
}

export interface Verification {
  round: number
  ok: boolean
  code: string
  reason: string
}

export interface ArbiterReview {
  round: number
  service: string
  arg: string
  reference: string
  seller: string
  payer: string
  challenger?: string
  raw: string
}

export interface ArbiterDecision {
  round: number
  ok: boolean
  code: string
  reason: string
}

export interface BondPosted {
  round: number
  seller: string
  holder: string
  amountSol: number
  sig: string
}

export interface ChallengeReview {
  round: number
  service: string
  arg: string
  raw: string
}

export interface ChallengeOpened {
  round: number
  by: string
  reason: string
  challenger?: string
  bondSig?: string
}

export interface ChallengeDecision {
  round: number
  upheld: boolean
  code: string
  reason: string
}

export interface Slash {
  round: number
  sig: string
  amountSol?: number
  from?: string
  to?: string
  bond?: 'seller' | 'challenger'
  settlement?: 'transfer' | 'arbiter'
  arbiter?: boolean
}

export interface EgressAudit {
  round: number
  seq: number
  decision: 'ALLOW' | 'DENY'
  action: string
  code?: string
  detail: string
}

const num = (text: string, key: string): number | undefined => {
  const m = text.match(new RegExp(`${key}=([\\d.]+)`))
  return m ? Number(m[1]) : undefined
}
const tok = (text: string, key: string): string | undefined =>
  text.match(new RegExp(`${key}=(\\S+)`))?.[1]
const quoted = (text: string, key: string): string | undefined =>
  text.match(new RegExp(`${key}="([^"]*)"`))?.[1]
const cleanQuote = (value: string): string => value.replace(/"/g, "'")

/** The leading verb of a market message (`WANT`, `BID`, ...), or '' if none. */
export function verb(text: string): string {
  return text.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
}

/** Extract the `round` tag for correlation, or undefined. */
export function messageRound(text: string): number | undefined {
  return num(text, 'round')
}

// -- WANT ----------------------------------------------------------------------
export function formatWant(w: Want): string {
  return `WANT round=${w.round} service=${w.service} arg=${w.arg} budget=${w.budgetSol}`
}
export function parseWant(text: string): Want | null {
  if (verb(text) !== 'WANT') return null
  const round = num(text, 'round')
  const service = tok(text, 'service')
  const arg = tok(text, 'arg')
  const budgetSol = num(text, 'budget')
  if (round == null || !service || arg == null || budgetSol == null) return null
  return { round, service, arg, budgetSol }
}

// -- BID -----------------------------------------------------------------------
export function formatBid(b: Bid): string {
  const base = `BID round=${b.round} price=${b.priceSol} by=${b.by}`
  return b.note ? `${base} note=${b.note}` : base
}
export function parseBid(text: string): Bid | null {
  if (verb(text) !== 'BID') return null
  const round = num(text, 'round')
  const priceSol = num(text, 'price')
  const by = tok(text, 'by')
  if (round == null || priceSol == null || !by) return null
  const note = text.match(/note=(.+)$/)?.[1]?.trim()
  return { round, priceSol, by, ...(note ? { note } : {}) }
}

// -- AWARD ---------------------------------------------------------------------
export function formatAward(round: number, to: string, reason?: string): string {
  const base = `AWARD round=${round} to=${to}`
  // The buyer's best-value justification, surfaced into the transcript (quotes neutralized so it
  // doesn't break parsing). The visualizer reads it via reason="...".
  return reason ? `${base} reason="${reason.replace(/"/g, "'")}"` : base
}
export function parseAward(text: string): { round: number; to: string; reason?: string } | null {
  if (verb(text) !== 'AWARD') return null
  const round = num(text, 'round')
  const to = tok(text, 'to')
  if (round == null || !to) return null
  const reason = text.match(/reason="([^"]*)"/)?.[1] // the quoted justification formatAward emits
  return { round, to, ...(reason ? { reason } : {}) }
}

// -- ESCROW_REQUIRED -------------------------------------------------------------
export function formatEscrowRequired(t: EscrowTerms): string {
  const base = `ESCROW_REQUIRED round=${t.round} reference=${t.reference} seller=${t.seller} amount=${t.amountSol} deadline=${t.deadlineSecs}`
  return t.settlement ? `${base} settlement=${t.settlement}` : base
}
export function parseEscrowRequired(text: string): EscrowTerms | null {
  if (verb(text) !== 'ESCROW_REQUIRED') return null
  const round = num(text, 'round')
  const reference = tok(text, 'reference')
  const seller = tok(text, 'seller')
  const amountSol = num(text, 'amount')
  const deadlineSecs = num(text, 'deadline')
  if (round == null || !reference || !seller || amountSol == null || deadlineSecs == null) return null
  const settlement = tok(text, 'settlement')
  return {
    round, reference, seller, amountSol, deadlineSecs,
    ...(settlement === 'direct' || settlement === 'arbiter' ? { settlement } : {}),
  }
}

// -- DEPOSITED -------------------------------------------------------------------
export function formatDeposited(d: Deposited): string {
  const parts = [`DEPOSITED round=${d.round}`, `reference=${d.reference}`, `buyer=${d.buyer}`, `sig=${d.sig}`]
  if (d.settlement) parts.push(`settlement=${d.settlement}`)
  if (d.vault) parts.push(`vault=${d.vault}`)
  if (d.arbiter) parts.push(`arbiter=${d.arbiter}`)
  return parts.join(' ')
}
export function parseDeposited(text: string): Deposited | null {
  if (verb(text) !== 'DEPOSITED') return null
  const round = num(text, 'round')
  const reference = tok(text, 'reference')
  const buyer = tok(text, 'buyer')
  const sig = tok(text, 'sig')
  if (round == null || !reference || !buyer || !sig) return null
  const settlement = tok(text, 'settlement')
  const vault = tok(text, 'vault')
  const arbiter = tok(text, 'arbiter')
  return {
    round, reference, buyer, sig,
    ...(settlement === 'direct' || settlement === 'arbiter' ? { settlement } : {}),
    ...(vault ? { vault } : {}),
    ...(arbiter ? { arbiter } : {}),
  }
}

// -- DELIVERED -------------------------------------------------------------------
export function formatDelivered(d: Delivered): string {
  return `DELIVERED round=${d.round} ${d.raw}`
}
export function parseDelivered(text: string): Delivered | null {
  if (verb(text) !== 'DELIVERED') return null
  const round = num(text, 'round')
  if (round == null) return null
  const raw = text.replace(/^DELIVERED\s+round=[\d.]+\s*/i, '').trim()
  return { round, raw }
}

// -- VERIFIED / VERIFICATION_FAILED ----------------------------------------------
export function formatVerified(v: Verification): string {
  const verb = v.ok ? 'VERIFIED' : 'VERIFICATION_FAILED'
  return `${verb} round=${v.round} ok=${v.ok ? 1 : 0} code=${v.code} reason="${cleanQuote(v.reason)}"`
}
export function parseVerified(text: string): Verification | null {
  const v = verb(text)
  if (v !== 'VERIFIED' && v !== 'VERIFICATION_FAILED') return null
  const round = num(text, 'round')
  const okTok = tok(text, 'ok')
  const code = tok(text, 'code')
  const reason = quoted(text, 'reason') ?? ''
  if (round == null || !code) return null
  return { round, ok: okTok === '1' || v === 'VERIFIED', code, reason }
}

// -- ARBITER_REVIEW / ARBITER_VERIFIED / ARBITER_REJECTED -----------------------
export function formatArbiterReview(r: ArbiterReview): string {
  const challenger = r.challenger ? ` challenger=${r.challenger}` : ''
  return `ARBITER_REVIEW round=${r.round} service=${r.service} arg="${cleanQuote(r.arg)}" reference=${r.reference} seller=${r.seller} payer=${r.payer}${challenger} delivery=${r.raw}`
}
export function parseArbiterReview(text: string): ArbiterReview | null {
  if (verb(text) !== 'ARBITER_REVIEW') return null
  const round = num(text, 'round')
  const service = tok(text, 'service')
  const arg = quoted(text, 'arg')
  const reference = tok(text, 'reference')
  const seller = tok(text, 'seller')
  const payer = tok(text, 'payer')
  const challenger = tok(text, 'challenger')
  const raw = text.match(/\sdelivery=(.+)$/)?.[1]?.trim()
  if (round == null || !service || arg == null || !reference || !seller || !payer || raw == null) return null
  return { round, service, arg, reference, seller, payer, ...(challenger ? { challenger } : {}), raw }
}

export function formatArbiterDecision(d: ArbiterDecision): string {
  const verb = d.ok ? 'ARBITER_VERIFIED' : 'ARBITER_REJECTED'
  return `${verb} round=${d.round} ok=${d.ok ? 1 : 0} code=${d.code} reason="${cleanQuote(d.reason)}"`
}
export function parseArbiterDecision(text: string): ArbiterDecision | null {
  const v = verb(text)
  if (v !== 'ARBITER_VERIFIED' && v !== 'ARBITER_REJECTED') return null
  const round = num(text, 'round')
  const okTok = tok(text, 'ok')
  const code = tok(text, 'code')
  const reason = quoted(text, 'reason') ?? ''
  if (round == null || !code) return null
  return { round, ok: okTok === '1' || v === 'ARBITER_VERIFIED', code, reason }
}

// -- L1 accountability: bonds, challenges, slashing -----------------------------
export function formatChallengeReview(r: ChallengeReview): string {
  return `CHALLENGE_REVIEW round=${r.round} service=${r.service} arg="${cleanQuote(r.arg)}" delivery=${r.raw}`
}
export function parseChallengeReview(text: string): ChallengeReview | null {
  if (verb(text) !== 'CHALLENGE_REVIEW') return null
  const round = num(text, 'round')
  const service = tok(text, 'service')
  const arg = quoted(text, 'arg')
  const raw = text.match(/\sdelivery=(.+)$/)?.[1]?.trim()
  if (round == null || !service || arg == null || raw == null) return null
  return { round, service, arg, raw }
}

export function formatBondPosted(b: BondPosted): string {
  return `BOND_POSTED round=${b.round} seller=${b.seller} holder=${b.holder} amount=${b.amountSol} sig=${b.sig}`
}
export function parseBondPosted(text: string): BondPosted | null {
  if (verb(text) !== 'BOND_POSTED') return null
  const round = num(text, 'round')
  const seller = tok(text, 'seller')
  const holder = tok(text, 'holder')
  const amountSol = num(text, 'amount')
  const sig = tok(text, 'sig')
  if (round == null || !seller || !holder || amountSol == null || !sig) return null
  return { round, seller, holder, amountSol, sig }
}

export function formatChallengeOpened(c: ChallengeOpened): string {
  const base = `CHALLENGE_OPENED round=${c.round} by=${c.by} reason="${cleanQuote(c.reason)}"`
  return [
    base,
    ...(c.challenger ? [`challenger=${c.challenger}`] : []),
    ...(c.bondSig ? [`bondSig=${c.bondSig}`] : []),
  ].join(' ')
}
export function parseChallengeOpened(text: string): ChallengeOpened | null {
  if (verb(text) !== 'CHALLENGE_OPENED') return null
  const round = num(text, 'round')
  const by = tok(text, 'by')
  const reason = quoted(text, 'reason') ?? ''
  const challenger = tok(text, 'challenger')
  const bondSig = tok(text, 'bondSig')
  if (round == null || !by) return null
  return { round, by, reason, ...(challenger ? { challenger } : {}), ...(bondSig ? { bondSig } : {}) }
}

export function formatChallengeDecision(d: ChallengeDecision): string {
  const v = d.upheld ? 'CHALLENGE_UPHELD' : 'CHALLENGE_REJECTED'
  return `${v} round=${d.round} code=${d.code} reason="${cleanQuote(d.reason)}"`
}
export function parseChallengeDecision(text: string): ChallengeDecision | null {
  const v = verb(text)
  if (v !== 'CHALLENGE_UPHELD' && v !== 'CHALLENGE_REJECTED') return null
  const round = num(text, 'round')
  const code = tok(text, 'code')
  const reason = quoted(text, 'reason') ?? ''
  if (round == null || !code) return null
  return { round, upheld: v === 'CHALLENGE_UPHELD', code, reason }
}

export function formatSlash(s: Slash): string {
  const v = s.arbiter ? 'ARBITER_SLASHED' : 'SLASHED'
  const parts = [`${v} round=${s.round}`, `sig=${s.sig}`]
  if (s.amountSol != null) parts.push(`amount=${s.amountSol}`)
  if (s.from) parts.push(`from=${s.from}`)
  if (s.to) parts.push(`to=${s.to}`)
  if (s.bond) parts.push(`bond=${s.bond}`)
  if (s.settlement) parts.push(`settlement=${s.settlement}`)
  return parts.join(' ')
}
export function parseSlash(text: string): Slash | null {
  const v = verb(text)
  if (v !== 'SLASHED' && v !== 'ARBITER_SLASHED') return null
  const round = num(text, 'round')
  const sig = tok(text, 'sig')
  if (round == null || !sig) return null
  const amountSol = num(text, 'amount')
  const from = tok(text, 'from')
  const to = tok(text, 'to')
  const bond = tok(text, 'bond')
  const settlement = tok(text, 'settlement')
  return {
    round,
    sig,
    ...(amountSol == null ? {} : { amountSol }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(bond === 'seller' || bond === 'challenger' ? { bond } : {}),
    ...(settlement === 'transfer' || settlement === 'arbiter' ? { settlement } : {}),
    ...(v === 'ARBITER_SLASHED' ? { arbiter: true } : {}),
  }
}

// -- EGRESS_AUDIT / EGRESS_DENIED -----------------------------------------------
/**
 * Stream every PEP verdict onto the shared thread for the firewall-style audit console. Unlike
 * `EGRESS_DENIED`, this line is non-terminal: an `ALLOW` audit proves the action was checked, while the
 * normal market verb (`DEPOSITED`, `RELEASED`, `REFUNDED`) still carries the settlement artifact.
 */
export function formatEgressAudit(a: EgressAudit): string {
  const code = a.code ? ` code=${a.code}` : ''
  return `EGRESS_AUDIT round=${a.round} seq=${a.seq} decision=${a.decision} action=${a.action}${code} detail=${a.detail.replace(/\s+/g, ' ').trim()}`
}
export function parseEgressAudit(text: string): EgressAudit | null {
  if (verb(text) !== 'EGRESS_AUDIT') return null
  const round = num(text, 'round')
  const seq = num(text, 'seq')
  const decision = tok(text, 'decision')
  const action = tok(text, 'action')
  if (round == null || seq == null || (decision !== 'ALLOW' && decision !== 'DENY') || !action) return null
  const code = tok(text, 'code')
  const detail = text.match(/\sdetail=(.*)$/)?.[1] ?? ''
  return { round, seq, decision, action, ...(code ? { code } : {}), detail }
}

/**
 * Surface an egress refusal onto the shared thread so the dashboard can show *why* an agent held back.
 * The line is **frozen** - the live feed regexes it - so `code` and `action` stay single tokens and the
 * free-text `detail` runs to end of line (it is the last field for exactly that reason). `action` is the
 * bare action kind (`deposit|release|refund|transfer|http`), `code` any `ReasonCode` (including the
 * caller-emitted reserved ones like SCHEMA_INVALID / INTEGRITY_MISMATCH).
 */
export function formatEgressDenied(round: number, code: ReasonCode, action: string, detail: string): string {
  return `EGRESS_DENIED round=${round} code=${code} action=${action} detail=${detail}`
}
export function parseEgressDenied(text: string): { round: number; code: string; action: string; detail: string } | null {
  if (verb(text) !== 'EGRESS_DENIED') return null
  const round = num(text, 'round')
  const code = tok(text, 'code')
  const action = tok(text, 'action')
  if (round == null || !code || !action) return null
  const detail = text.match(/\sdetail=(.*)$/)?.[1] ?? '' // free text, to end of line
  return { round, code, action, detail }
}

// -- selection -------------------------------------------------------------------
/** Keep only bids for `round`, deduped by seller (last bid wins). */
export function selectBids(bids: Bid[], round: number): Bid[] {
  const bySeller = new Map<string, Bid>()
  for (const b of bids) if (b.round === round) bySeller.set(b.by, b)
  return [...bySeller.values()]
}

/** The cheapest bid (does not mutate input); undefined if none. Ties -> first seen. */
export function pickCheapest(bids: Bid[]): Bid | undefined {
  return [...bids].sort((a, b) => a.priceSol - b.priceSol)[0]
}
