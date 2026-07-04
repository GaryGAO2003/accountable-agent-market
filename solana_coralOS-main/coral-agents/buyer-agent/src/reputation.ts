/**
 * Buyer-side L3 reputation wiring - the pure, unit-testable pieces the market loop composes.
 *
 * The reputation *authority* (scoring, tiers, the frozen REPUTATION wire line) lives in the runtime
 * (`@pay/agent-runtime`, R1). This module is the buyer's thin market-layer glue over it:
 *   - `partitionFlagged` - the one-way freeze: split a bid pool into sellers still in good standing vs. the
 *     flagged ones the buyer drops, so a repeat offender can never be re-awarded. The ledger itself is pure
 *     score math and would let a flagged seller climb back to neutral; the irreversibility is enforced HERE,
 *     at the market layer, by never giving a flagged seller another round to earn those settles.
 *   - `makeRecordOnce` - the round's single-shot outcome recorder: folds the FIRST terminal outcome into the
 *     ledger, (optionally) anchors it on-chain, and broadcasts the standing change into the thread.
 * Both are I/O-free by construction (side effects are injected), so the loop's behaviour is CI-pinnable.
 */
import {
  ReputationLedger, formatReputation,
  type RepOutcome,
} from '@pay/agent-runtime'

/**
 * Split `pool` into `active` (sellers the buyer may still award) and `frozen` (flagged, dropped). Pure and
 * order-preserving. The freeze is the market-layer one-way door the ledger deliberately does not enforce.
 */
export function partitionFlagged<T>(
  pool: readonly T[],
  isFlagged: (item: T) => boolean,
): { active: T[]; frozen: T[] } {
  const active: T[] = []
  const frozen: T[] = []
  for (const item of pool) (isFlagged(item) ? frozen : active).push(item)
  return { active, frozen }
}

/** The buyer-log line for a bid dropped because its seller is frozen out (flagged). */
export function frozenOutLine(round: number, seller: string, score: number): string {
  return `[rep] round ${round}: ${seller} frozen out (score=${score}, flagged) - bid ignored`
}

/** Injected side effects for {@link makeRecordOnce} - the loop wires real ones; tests wire mocks. */
export interface RecordOnceDeps {
  ledger: ReputationLedger
  round: number
  /** The awarded seller whose standing this round updates. */
  seller: string
  /** Whether to anchor the standing change on-chain via an SPL memo (REP_MEMO). */
  memo: boolean
  /** Write the REPUTATION line on-chain, resolving the memo signature. Throws on RPC failure. */
  writeMemo: (text: string) => Promise<string>
  /** Broadcast the REPUTATION line into the market thread, addressed to the seller. */
  sendThread: (line: string) => Promise<void>
  /** Structured log sink (console.error in the loop). */
  log: (line: string) => void
}

/**
 * Build the round's one-shot reputation recorder. The returned `recordOnce`:
 *   - is a no-op after the first call this round (**first terminal outcome wins**: a verify_failed that
 *     later refunds records verify_failed, not refunded), so there is exactly ONE ledger update and ONE
 *     REPUTATION thread line per round;
 *   - folds the outcome into the ledger, then (if `memo`) anchors the standing line on-chain - the memo is
 *     an on-chain LOG of a standing change, NOT a money action, so it deliberately bypasses the egress PEP
 *     (which fences payments); a memo RPC failure degrades to a thread-only record;
 *   - broadcasts the standing line into the thread (carrying `sig` iff the memo landed) and logs it.
 * One recorder is created per round, so its guard resets each round.
 */
export function makeRecordOnce(deps: RecordOnceDeps): (outcome: RepOutcome) => Promise<void> {
  let recorded = false
  return async (outcome: RepOutcome): Promise<void> => {
    if (recorded) return
    recorded = true
    const { score, tier } = deps.ledger.update(deps.seller, outcome)
    let sig: string | undefined
    if (deps.memo) {
      try {
        sig = await deps.writeMemo(formatReputation({ seller: deps.seller, score, tier, outcome, round: deps.round }))
      } catch {
        deps.log('[rep] memo write failed - thread-only')
      }
    }
    await deps.sendThread(
      formatReputation({ seller: deps.seller, score, tier, outcome, round: deps.round, ...(sig ? { sig } : {}) }),
    )
    deps.log(`[rep] round ${deps.round}: ${deps.seller} -> ${tier} (score ${score}) outcome=${outcome}`)
  }
}
