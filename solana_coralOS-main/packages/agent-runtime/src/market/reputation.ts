/**
 * Reputation ledger (L3) - the market's memory, and the last of three lines of defense against a
 * misbehaving seller.
 *
 * The kit already fences bad delivery two ways, but both are **per-incident** and forget everything the
 * moment the round ends:
 *   - **L1 (settlement)** refunds the buyer when a delivery fails verification - the money is made whole
 *     for *this* order, but nothing stops the same seller from winning the *next* one.
 *   - **L2 (egress PEP)** blocks a single bad outbound action - this attempt is denied, but the check is
 *     stateless across rounds, so a persistent adversary just tries again.
 *
 * **L3 (this module)** is the cross-round memory those two lack: it folds every outcome per seller into a
 * running score, so a repeat offender's standing decays until the buyer simply stops *awarding* it work
 * at all. L1 gets the money back, L2 stops one action, L3 stops the relationship.
 *
 * Pure state machine - **no clock, no I/O, no network.** A seller's standing is a deterministic function
 * of the outcome history fed in, so the same sequence always yields the same score/tier and CI can pin
 * every boundary. (This is the deliberate opposite of the egress PEP, which holds no state between calls;
 * here the accumulated state *is* the product.)
 */

/** A settled order's terminal outcome from the buyer's point of view - the only four things that happen to a seller in a round. */
export type RepOutcome = 'settled' | 'refunded' | 'blocked' | 'verify_failed'

/**
 * Standing bands. `trusted` sellers are preferred, `neutral` is the unproven default, and a `flagged`
 * seller is one the buyer should freeze out (see the one-way-door note on {@link ReputationLedger}).
 */
export type RepTier = 'trusted' | 'neutral' | 'flagged'

/**
 * Scoring weights: **one fraud outweighs one good delivery.** A clean delivery earns +2; every failure
 * mode - an honest refund, a blocked action, a failed verification - costs -3, all treated as the same
 * class of "the buyer did not get what it paid for." The asymmetry (|-3| > +2) is intentional: reputation
 * is built slowly and lost fast, so a single fraud cannot be laundered by one good round - it takes two
 * clean deliveries to climb back above where one refund dropped you.
 */
export const REP_WEIGHTS: Record<RepOutcome, number> = { settled: +2, refunded: -3, blocked: -3, verify_failed: -3 }

/**
 * Tier boundaries, **both inclusive**: score >= `trust` is `trusted`, score <= `flag` is `flagged`,
 * anything strictly between is `neutral`. Defaults `{ trust: 2, flag: -3 }` - exactly one clean delivery
 * earns trust, exactly one fraud earns a flag.
 */
export interface RepThresholds { trust: number; flag: number }

/** A seller's current standing plus the ordered outcome history that produced it. */
export interface RepEntry { seller: string; score: number; tier: RepTier; outcomes: RepOutcome[] }

/**
 * Per-seller cumulative reputation - a pure state machine over outcomes (no clock, no I/O). Feed it the
 * outcome of every settled round via {@link update}; read a seller's standing back with {@link score} /
 * {@link tier}; stream the whole table (first-seen order) via {@link entries}.
 */
export class ReputationLedger {
  readonly #thresholds: RepThresholds
  readonly #entries = new Map<string, RepEntry>() // insertion order == first-seen order (JS Map guarantee)

  constructor(thresholds: Partial<RepThresholds> = {}) {
    this.#thresholds = { trust: thresholds.trust ?? 2, flag: thresholds.flag ?? -3 }
  }

  /**
   * Fold one outcome into `seller`'s standing: apply its weight, append it to the history, recompute the
   * tier, and return the new standing. The first sighting of a seller creates its entry at score 0.
   */
  update(seller: string, outcome: RepOutcome): { score: number; tier: RepTier } {
    let entry = this.#entries.get(seller)
    if (!entry) {
      entry = { seller, score: 0, tier: this.#tierFor(0), outcomes: [] }
      this.#entries.set(seller, entry)
    }
    entry.score += REP_WEIGHTS[outcome]
    entry.outcomes.push(outcome)
    entry.tier = this.#tierFor(entry.score)
    return { score: entry.score, tier: entry.tier }
  }

  /** Current score, or 0 for a seller never seen. */
  score(seller: string): number {
    return this.#entries.get(seller)?.score ?? 0
  }

  /**
   * Current tier, or `neutral` for a seller never seen. An unrated seller is neutral **by definition** -
   * we return that directly rather than running score 0 through the thresholds, so a degenerate
   * `trust <= 0` config can't accidentally "trust" a seller that has never delivered anything.
   */
  tier(seller: string): RepTier {
    return this.#entries.get(seller)?.tier ?? 'neutral'
  }

  /** All entries in stable first-seen order (a fresh array over the live entry objects). */
  get entries(): readonly RepEntry[] {
    return [...this.#entries.values()]
  }

  /**
   * Map a score to a tier. `trusted` is tested before `flagged` so a degenerate overlapping config
   * (`trust <= flag`) resolves deterministically to the optimistic band instead of being ambiguous.
   *
   * NOTE - **`flagged` is not sticky here.** The ledger is pure score math, so a flagged seller that
   * somehow settled enough good rounds *would* climb back to neutral/trusted. That is intentional: the
   * irreversibility lives one layer up. The buyer freezes a flagged seller out of future awards, so it
   * never gets the chance to earn those settles. The freeze is a deliberate **one-way door at the market
   * layer, not the ledger layer** - keeping it out of here keeps this module a pure, replayable function
   * of its inputs.
   */
  #tierFor(score: number): RepTier {
    if (score >= this.#thresholds.trust) return 'trusted'
    if (score <= this.#thresholds.flag) return 'flagged'
    return 'neutral'
  }
}

// -- wire format -----------------------------------------------------------------
/**
 * REPUTATION line - the standing update the dashboard feed and the parallel track key off. **Frozen**:
 * field order and names are fixed and `sig` is the only optional field, always trailing. Emit one
 * whenever a seller's standing changes so a live view can redraw its trust badge, and (optionally) anchor
 * the same line on-chain via `solana/memo.ts`.
 *
 *   REPUTATION seller=<name> score=<int> tier=<trusted|neutral|flagged> outcome=<settled|refunded|blocked|verify_failed> round=<n>[ sig=<base58>]
 *
 * `score` is a **signed** integer - a flagged seller's score is negative - so the parser must accept a
 * leading `-`. The shared numeric helpers in `protocol.ts` match digits only; that mismatch is exactly
 * why reputation ships its own tiny parse helpers instead of importing them (and why format/parse live
 * here, self-contained, rather than in the teammate-owned protocol module).
 */
export function formatReputation(u: {
  seller: string
  score: number
  tier: RepTier
  outcome: RepOutcome
  round: number
  sig?: string
}): string {
  const base = `REPUTATION seller=${u.seller} score=${u.score} tier=${u.tier} outcome=${u.outcome} round=${u.round}`
  return u.sig ? `${base} sig=${u.sig}` : base
}

/**
 * Parse a REPUTATION line, or `null` for any other verb (an EGRESS_DENIED / RELEASED / ... line passes
 * straight through as `null`). Tolerant by design: `tier` and `outcome` come back as raw **strings**, not
 * the narrowed unions, so a line carrying a value this build doesn't recognize still parses instead of
 * being dropped - the reader decides what to do with an unknown band. seller/score/tier/outcome/round are
 * all required; `sig` is optional and tolerated when present.
 */
export function parseReputation(
  text: string,
): { seller: string; score: number; tier: string; outcome: string; round: number; sig?: string } | null {
  if (repVerb(text) !== 'REPUTATION') return null
  const seller = repToken(text, 'seller')
  const score = repInt(text, 'score')
  const tier = repToken(text, 'tier')
  const outcome = repToken(text, 'outcome')
  const round = repInt(text, 'round')
  if (!seller || score == null || !tier || !outcome || round == null) return null
  const sig = repToken(text, 'sig')
  return { seller, score, tier, outcome, round, ...(sig ? { sig } : {}) }
}

/** Leading verb, upper-cased. Local to reputation so this module owns its own parse (protocol.ts is another track's file). */
function repVerb(text: string): string {
  return text.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
}
/** First `key=<non-space>` token value, or undefined. */
function repToken(text: string, key: string): string | undefined {
  return text.match(new RegExp(`(?:^|\\s)${key}=(\\S+)`))?.[1]
}
/** A **signed** integer field (accepts a leading `-`, unlike protocol.ts's digit-only helper - see formatReputation). */
function repInt(text: string, key: string): number | undefined {
  const raw = repToken(text, key)
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isInteger(n) ? n : undefined
}
