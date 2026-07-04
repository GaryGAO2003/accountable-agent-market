/**
 * Buyer agent - the marketplace buyer. Broadcasts a WANT into a shared CoralOS thread, collects
 * competing LLM bids, picks the best value, and settles through the escrow contract:
 *
 *   WANT -> (collect BIDs for a window) -> AWARD winner -> wait ESCROW_REQUIRED ->
 *   deposit() into escrow -> DEPOSITED -> wait DELIVERED -> release() to the seller
 *
 * Selection uses the LLM (best value), with a deterministic cheapest fallback so a slow/missing model
 * never hangs the round. Settlement is escrow-only - funds are conditional on delivery.
 *
 * Env: BUYER_KEYPAIR_B58 (signs), BUYER_MAX_SOL (budget), BUYER_SERVICE/BUYER_ARG (the WANT),
 *      MARKET_SELLERS (csv of seller names), BID_WINDOW_MS, SOLANA_RPC_URL,
 *      VENICE_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY (+ LLM_PROVIDER), TRACE=1.
 *
 * The deposit/release calls settle against the escrow program deployed to devnet; they need a funded
 * devnet wallet + live RPC, so they run in a live market session rather than in `npm test`/CI.
 */
import {
  startCoralAgent, complete, parseJsonReply, loadKeypairB58,
  formatWant, parseBid, parseEscrowRequired, formatAward, formatDeposited,
  parseDelivered, formatVerified, formatArbiterReview, parseChallengeOpened,
  formatChallengeReview, formatChallengeOpened, formatChallengeDecision, formatSlash, signTransfer,
  selectBids, pickCheapest,
  commitEgress, newEgressState, AuditLog,
  type Bid, type Delivered, type EscrowTerms, type CoralAgentContext, type ChallengeOpened,
} from '@pay/agent-runtime'
import { PublicKey } from '@solana/web3.js'
import { makeProgram, deposit, release, refund, escrowPda } from './escrow.js'
import {
  ARBITER_PROGRAM_ID, ensureArbiterConfig, ensureArbiterFunded, makeArbiter,
  openArbitrated, arbitrateRelease, arbitratedEscrowPda,
} from './arbiter.js'
import { buildEgressPolicy, checkEgressAudited } from './guard.js'
import { verifyDelivery } from './verify.js'
import { planChallengeWindow } from './challenge.js'

const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const BUDGET = Number(process.env.BUYER_MAX_SOL ?? '0.001')
const SERVICE = process.env.BUYER_SERVICE ?? 'txline'
// Rotate through several args so each round trades a *different* thing (BUYER_ARGS=csv of fixture ids,
// else the single BUYER_ARG). This is what stops the market looking like the same round on a loop.
const ARGS = (process.env.BUYER_ARGS || process.env.BUYER_ARG || 'SOL-USDC').split(',').map((s) => s.trim()).filter(Boolean)
const ARG = ARGS[0]
const BID_WINDOW_MS = Number(process.env.BID_WINDOW_MS ?? '5000')
const CYCLE_MS = Number(process.env.CYCLE_INTERVAL_MS ?? '30000')
// Longest deadline the buyer will wait out in-round to reclaim funds from a no-show (direct escrow only).
const REFUND_WAIT_CAP_SECS = 120
const SELLERS = (process.env.MARKET_SELLERS ?? 'seller-worldcup,seller-fast,seller-premium')
  .split(',').map((s) => s.trim()).filter(Boolean)
const ARBITER_AGENT_ENABLED = process.env.ARBITER_AGENT_ENABLED === '1'
const ARBITER_AGENT_NAME = process.env.ARBITER_AGENT_NAME ?? 'arbiter-agent'
const CHALLENGER_AGENT_ENABLED = process.env.CHALLENGER_AGENT_ENABLED === '1'
const CHALLENGER_AGENT_NAME = process.env.CHALLENGER_AGENT_NAME ?? 'challenger-agent'
const CHALLENGE_WINDOW_MS = Number(process.env.CHALLENGE_WINDOW_MS ?? '5000')
const AUTO_CHALLENGE_ON_FAILED_VERIFY = process.env.AUTO_CHALLENGE_ON_FAILED_VERIFY !== '0'
const SELLER_BOND_SOL = Number(process.env.SELLER_BOND_SOL ?? '0.0001')
// F3 / egress recipient allowlist: the payout wallet the buyer expects sellers to be paid at (the demo
// personas share one receive wallet). When set it becomes the PEP's sole allowed recipient, so an
// ESCROW_REQUIRED naming a different seller= trips RECIPIENT_NOT_ALLOWED before any deposit. Read from
// EXPECTED_SELLER_WALLET, falling back to the legacy SELLER_WALLET alias.
const EXPECTED_SELLER_WALLET = process.env.EXPECTED_SELLER_WALLET ?? process.env.SELLER_WALLET ?? ''
// Egress PEP velocity cap: max money actions (deposit/release/refund) per rolling 60s. 0/NaN -> default 30.
// Default sits well above the market's natural cadence (a settled round commits 2 actions, and escrow
// deadlines pace rounds to well under 15/min) so it never false-trips a demo, while still catching a
// runaway loop hammering payments. Lower it in .env to demo the throttle deliberately.
const BUYER_MAX_TX_PER_MIN = Number(process.env.BUYER_MAX_TX_PER_MIN ?? '30') || 30
// Egress PEP budget cap: cumulative deposit spend for the whole session, in SOL. 0 = no cap.
const BUYER_SESSION_BUDGET_SOL = Number(process.env.BUYER_SESSION_BUDGET_SOL ?? '0')
// The session egress policy - the code-enforced fence every money action passes before it leaves the
// buyer. Built once from env at startup (read-only for the session); mutable counters live in egressState.
const egressPolicy = buildEgressPolicy({
  expectedSellerWallet: EXPECTED_SELLER_WALLET,
  maxTxPerMin: BUYER_MAX_TX_PER_MIN,
  sessionBudgetSol: BUYER_SESSION_BUDGET_SOL,
})
const SETTLEMENT_MODE = (process.env.SETTLEMENT_MODE ?? 'arbiter').toLowerCase()
const trace = process.env.TRACE === '1'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const expl = (kind: 'tx' | 'address', id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`

/** Best-value selection via LLM; deterministic cheapest fallback. Returns the winner + its reasoning. */
async function pickWinner(pool: Bid[]): Promise<{ winner: Bid; reason?: string }> {
  if (pool.length === 1) return { winner: pool[0] }
  try {
    const system =
      'You are a buyer choosing the best-value bid for a Solana data service. ' +
      'Reply ONLY with JSON {"by": "<seller name>", "reason": "<short>"}.'
    const user =
      `service=${SERVICE} arg=${ARG} budget=${BUDGET}\nbids:\n` +
      pool.map((b) => `- ${b.by}: ${b.priceSol} SOL${b.note ? ` (${b.note})` : ''}`).join('\n')
    const parsed = parseJsonReply<{ by?: string; reason?: string }>(await complete({ system, user, maxTokens: 100 }))
    const chosen = pool.find((b) => b.by === parsed?.by)
    if (chosen) {
      console.error(`[buyer] picked ${chosen.by} (${chosen.priceSol} SOL): ${parsed?.reason ?? ''}`)
      return { winner: chosen, reason: parsed?.reason }
    }
  } catch {
    /* fall through to deterministic choice */
  }
  return { winner: pickCheapest(pool)!, reason: 'cheapest available' }
}

/** Wait (bounded) for a message matching `round` that `parse` accepts. */
async function waitFor<T>(
  ctx: CoralAgentContext,
  round: number,
  parse: (text: string) => (T & { round: number }) | null,
  maxMs: number,
): Promise<T | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const m = await ctx.waitForMention(Math.max(500, deadline - Date.now()))
    if (!m) continue
    const parsed = parse(m.text)
    if (parsed && parsed.round === round) return parsed
  }
  return null
}

await startCoralAgent({ agentName: process.env.AGENT_NAME ?? 'buyer-agent' }, async (ctx) => {
  const buyer = loadKeypairB58('BUYER_KEYPAIR_B58')
  const arbiter = SETTLEMENT_MODE === 'arbiter' ? loadKeypairB58('ARBITER_KEYPAIR_B58') : null
  console.error(`[buyer] market buyer - wallet=${buyer.publicKey.toBase58()} budget=${BUDGET} sellers=[${SELLERS.join(',')}]`)

  // One egress state + audit log for the whole session: check -> act -> commit advances egressState only
  // after an action lands, and every verdict (allow or deny) is appended to auditLog (docker logs = sink).
  const egressState = newEgressState()
  const auditLog = new AuditLog('buyer')

  const threadParticipants = [
    ...SELLERS,
    ...(CHALLENGER_AGENT_ENABLED ? [CHALLENGER_AGENT_NAME] : []),
    ...(ARBITER_AGENT_ENABLED ? [ARBITER_AGENT_NAME] : []),
  ]
  for (const s of threadParticipants) {
    try { await ctx.waitForAgent(s, 8000) } catch { /* seller may already be present */ }
  }
  const thread = await ctx.createThread('market', threadParticipants)
  const program = await makeProgram(buyer, RPC)
  if (arbiter) {
    await ensureArbiterConfig(buyer, arbiter.publicKey, RPC)
    await ensureArbiterFunded(buyer, arbiter.publicKey, RPC)
  }
  let round = 0

  while (true) {
    try {
      round++
      const arg = ARGS[(round - 1) % ARGS.length] // rotate fixtures so consecutive rounds differ
      if (trace) console.error(`[buyer] round ${round}: WANT ${SERVICE} ${arg} budget=${BUDGET}`)
      await ctx.send(formatWant({ round, service: SERVICE, arg, budgetSol: BUDGET }), thread, SELLERS)

      // -- collect competing bids during the window --------------------------
      const bids: Bid[] = []
      const deadline = Date.now() + BID_WINDOW_MS
      while (Date.now() < deadline) {
        const m = await ctx.waitForMention(Math.max(500, deadline - Date.now()))
        if (!m) continue
        const b = parseBid(m.text)
        if (b && b.round === round) bids.push(b)
      }
      const pool = selectBids(bids, round)
      if (pool.length === 0) { console.error(`[buyer] round ${round}: NO_SELLERS`); await sleep(CYCLE_MS); continue }

      // -- award the best value ----------------------------------------------
      const { winner, reason } = await pickWinner(pool)
      await ctx.send(formatAward(round, winner.by, reason), thread, [winner.by])

      // -- settle through escrow: deposit -> DEPOSITED -> wait DELIVERED -> release
      const terms = await waitFor<EscrowTerms>(ctx, round, parseEscrowRequired, 15_000)
      if (!terms) { console.error(`[buyer] round ${round}: no escrow terms from ${winner.by}`); await sleep(CYCLE_MS); continue }
      // EGRESS PEP - gate the deposit before either settlement rail signs anything: it locks the buyer's
      // own funds toward the seller's payout wallet + reference carried in ESCROW_REQUIRED. A hijacked
      // ESCROW_REQUIRED naming an unexpected seller= trips RECIPIENT_NOT_ALLOWED here (subsuming the old
      // payoutMatches F3 bind); a replayed reference / over-budget / burst is caught too. On a deny no tx
      // is signed - the verdict is audited, EGRESS_DENIED goes to the winner, and the round is skipped.
      const depositAction = { kind: 'deposit', recipient: terms.seller, amountSol: terms.amountSol, reference: terms.reference } as const
      const depositVerdict = await checkEgressAudited(egressState, egressPolicy, auditLog, round, depositAction,
        (line) => ctx.send(line, thread, [winner.by]))
      if (!depositVerdict.allow) {
        console.error(`[buyer] round ${round}: deposit blocked (${depositVerdict.code}) - ${depositVerdict.detail}`)
        await sleep(CYCLE_MS); continue
      }

      const reference = new PublicKey(terms.reference)
      const seller = new PublicKey(terms.seller)
      const requestedSettlement = terms.settlement ?? (SETTLEMENT_MODE === 'direct' ? 'direct' : 'arbiter')
      let depositSig: string
      let vault: PublicKey | undefined
      if (requestedSettlement === 'arbiter') {
        if (!arbiter) throw new Error('ARBITER_KEYPAIR_B58 is required for SETTLEMENT_MODE=arbiter')
        const opened = await openArbitrated(makeArbiter(buyer, RPC), buyer, seller, reference, terms.amountSol, terms.deadlineSecs)
        depositSig = opened.sig
        vault = opened.vault
      } else {
        depositSig = await deposit(program, buyer, seller, reference, terms.amountSol, terms.deadlineSecs)
      }
      commitEgress(egressState, depositAction, Date.now()) // check -> act -> commit: the funds have now left
      const depositedAtMs = Date.now() // anchors the on-chain refund deadline for the no-delivery path
      // Reclaim the deposit once the on-chain deadline passes - shared by the no-delivery and
      // failed-verification outcomes. Direct escrow only: the arbiter path owns its own refunds.
      const canRefundInRound = requestedSettlement === 'direct' && terms.deadlineSecs <= REFUND_WAIT_CAP_SECS
      const refundAfterDeadline = async (): Promise<void> => {
        // Wait out the deadline (+5s for cluster clock skew), then reclaim with refund() and broadcast it.
        const waitMs = depositedAtMs + terms.deadlineSecs * 1000 + 5_000 - Date.now()
        if (waitMs > 0) await sleep(waitMs)
        // EGRESS PEP - a refund returns escrow to the buyer's OWN wallet (no recipient allowlist, no
        // budget: this is money coming back), but it still passes the velocity fence + amount sanity. If
        // the PEP denies it, leave the funds locked (they stay refundable) and mirror the audit verdict to
        // the thread so the dashboard still shows that the refund path was checked.
        const refundAction = { kind: 'refund', recipient: buyer.publicKey.toBase58(), amountSol: terms.amountSol } as const
        const refundVerdict = await checkEgressAudited(egressState, egressPolicy, auditLog, round, refundAction,
          (line) => ctx.send(line, thread, [winner.by]))
        if (!refundVerdict.allow) {
          console.error(`[buyer] round ${round}: refund blocked by egress (${refundVerdict.code}) - funds stay locked`)
          return
        }
        let refundSig: string | null = null
        for (let attempt = 1; attempt <= 4 && !refundSig; attempt++) {
          try {
            refundSig = await refund(program, buyer, reference)
          } catch (e) {
            // The escrow throws BeforeDeadline if the cluster clock lags local - retrying is the fix.
            if (attempt === 4) console.error(`[buyer] round ${round}: refund failed after 4 attempts - ${e}`)
            else await sleep(5_000)
          }
        }
        if (refundSig) {
          commitEgress(egressState, refundAction, Date.now()) // check -> act -> commit
          console.error(`[buyer] round ${round}: REFUNDED from ${winner.by} - ${expl('tx', refundSig)}`)
          await ctx.send(`REFUNDED round=${round} sig=${refundSig} settlement=direct`, thread, [winner.by])
        }
      }
      console.error(`[buyer] round ${round}: DEPOSITED ${terms.amountSol} SOL -> ${winner.by}`)
      if (trace) {
        if (requestedSettlement === 'arbiter' && vault) {
          console.error(`[buyer]   arbiter: ${expl('address', ARBITER_PROGRAM_ID.toBase58())}`)
          console.error(`[buyer]   vault PDA: ${expl('address', vault.toBase58())}`)
          console.error(`[buyer]   escrow PDA: ${expl('address', arbitratedEscrowPda(vault, reference).toBase58())}`)
          console.error(`[buyer]   open tx: ${expl('tx', depositSig)}`)
        } else {
          console.error(`[buyer]   escrow PDA: ${expl('address', escrowPda(buyer.publicKey, reference).toBase58())}`)
          console.error(`[buyer]   deposit tx: ${expl('tx', depositSig)}`)
        }
      }
      await ctx.send(
        formatDeposited({
          round,
          reference: terms.reference,
          buyer: buyer.publicKey.toBase58(),
          sig: depositSig,
          settlement: requestedSettlement,
          ...(vault && arbiter ? { vault: vault.toBase58(), arbiter: arbiter.publicKey.toBase58() } : {}),
        }),
        thread, [winner.by],
      )

      const delivered = await waitFor<Delivered>(ctx, round, parseDelivered, 30_000)

      if (delivered) {
        const challengePlan = await planChallengeWindow(
          { service: SERVICE, arg },
          delivered.raw,
          { round, challengeWindowMs: CHALLENGE_WINDOW_MS, autoChallenge: CHALLENGER_AGENT_ENABLED ? false : AUTO_CHALLENGE_ON_FAILED_VERIFY },
        )
        if (challengePlan.verification?.ok) {
          await ctx.send(formatVerified({ round, ...challengePlan.verification }), thread, [winner.by])
        }
        if (CHALLENGER_AGENT_ENABLED) {
          await ctx.send(formatChallengeReview({ round, service: SERVICE, arg, raw: delivered.raw }), thread, [CHALLENGER_AGENT_NAME])
        }

        let challenge: ChallengeOpened | null = null
        if (challengePlan.action === 'challenge') {
          challenge = { round, by: 'buyer-agent', reason: challengePlan.reason }
          await ctx.send(formatChallengeOpened(challenge), thread, ARBITER_AGENT_ENABLED ? [winner.by, ARBITER_AGENT_NAME] : [winner.by])
        } else if (challengePlan.waitMs > 0) {
          challenge = await waitFor<ChallengeOpened>(ctx, round, parseChallengeOpened, challengePlan.waitMs)
        }

        if (challenge) {
          if (ARBITER_AGENT_ENABLED) {
            // Arbiter-agent settlement: the neutral arbiter agent re-execs + signs release/refund/slash.
            if (requestedSettlement !== 'arbiter' || !vault || !arbiter) {
              console.error(`[buyer] round ${round}: challenged arbiter-agent mode requires settlement=arbiter - funds stay in escrow`)
              await sleep(CYCLE_MS)
              continue
            }
            await ctx.send(
              formatArbiterReview({
                round,
                service: SERVICE,
                arg,
                reference: terms.reference,
                seller: terms.seller,
                payer: buyer.publicKey.toBase58(),
                ...(challenge.challenger ? { challenger: challenge.challenger } : {}),
                raw: delivered.raw,
              }),
              thread,
              [ARBITER_AGENT_NAME],
            )
            console.error(`[buyer] round ${round}: ${challenge.by} opened challenge; delegated objective re-exec to ${ARBITER_AGENT_NAME}`)
            await sleep(CYCLE_MS)
            continue
          }

          const verification = challengePlan.verification ?? await verifyDelivery({ service: SERVICE, arg }, delivered.raw)
          await ctx.send(formatVerified({ round, ...verification }), thread, [winner.by])
          await ctx.send(formatChallengeDecision({
            round,
            upheld: !verification.ok,
            code: verification.code,
            reason: verification.reason,
          }), thread, [winner.by])
          if (!verification.ok) {
            console.error(`[buyer] round ${round}: challenge upheld (${verification.code}) - ${verification.reason}`)
            if (arbiter && SELLER_BOND_SOL > 0) {
              try {
                const slashSig = await signTransfer(arbiter, challenge.challenger ?? buyer.publicKey.toBase58(), SELLER_BOND_SOL, { maxSol: SELLER_BOND_SOL })
                await ctx.send(formatSlash({
                  round,
                  sig: slashSig,
                  amountSol: SELLER_BOND_SOL,
                  from: arbiter.publicKey.toBase58(),
                  to: challenge.challenger ?? buyer.publicKey.toBase58(),
                  bond: 'seller',
                  settlement: 'transfer',
                  arbiter: true,
                }), thread, [winner.by])
              } catch (e) {
                console.error(`[buyer] round ${round}: slash transfer failed - ${e}`)
              }
            }
            if (canRefundInRound) {
              await refundAfterDeadline() // bad data is treated like no delivery: the money comes back
            } else {
              console.error(`[buyer] round ${round}: funds stay in escrow, refundable after the deadline`)
            }
            await sleep(CYCLE_MS)
            continue
          }
        }
        // EGRESS PEP - releasing pays the seller out of escrow; gate the payout (recipient allowlist +
        // velocity) before signing. A denied release leaves the round unsettled (funds stay locked - the
        // deadline refund path may still reclaim them later).
        const releaseAction = { kind: 'release', recipient: terms.seller, amountSol: terms.amountSol } as const
        const releaseVerdict = await checkEgressAudited(egressState, egressPolicy, auditLog, round, releaseAction,
          (line) => ctx.send(line, thread, [winner.by]))
        if (!releaseVerdict.allow) {
          console.error(`[buyer] round ${round}: release blocked (${releaseVerdict.code}) - funds stay in escrow`)
          await sleep(CYCLE_MS)
          continue
        }
        const releaseSig = requestedSettlement === 'arbiter' && arbiter
          ? await arbitrateRelease(makeArbiter(arbiter, RPC), arbiter, seller, reference)
          : await release(program, buyer, seller, reference)
        commitEgress(egressState, releaseAction, Date.now()) // check -> act -> commit
        const releaseVerb = requestedSettlement === 'arbiter' ? 'ARBITER_RELEASED' : 'RELEASED'
        console.error(`[buyer] round ${round}: ${releaseVerb} to ${winner.by} - ${expl('tx', releaseSig)}`)
        await ctx.send(`${releaseVerb} round=${round} sig=${releaseSig} settlement=${requestedSettlement}`, thread, [winner.by])
      } else if (canRefundInRound) {
        // Accountability path: the winner took the escrow and never delivered.
        await refundAfterDeadline()
      } else {
        console.error(`[buyer] round ${round}: no delivery - funds stay in escrow, refundable after the deadline`)
      }
    } catch (e) {
      console.error(`[buyer] round error: ${e}`)
    }
    await sleep(CYCLE_MS)
  }
})
