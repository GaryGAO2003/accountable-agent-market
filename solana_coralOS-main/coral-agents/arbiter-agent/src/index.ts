import { PublicKey } from '@solana/web3.js'
import {
  formatArbiterDecision,
  loadKeypairB58,
  parseArbiterReview,
  startCoralAgent,
} from '@pay/agent-runtime'
import { decideArbitration } from './decision.js'
import { arbitrateRefund, arbitrateRelease, makeArbiter } from './settlement.js'

const NAME = process.env.AGENT_NAME ?? 'arbiter-agent'
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const REFUND_ON_REJECT = process.env.ARBITER_REFUND_ON_REJECT === '1'
const trace = process.env.TRACE === '1'

const safeReason = (value: string): string => value.replace(/"/g, "'")
const expl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

await startCoralAgent({ agentName: NAME }, async (ctx) => {
  const arbiter = loadKeypairB58('ARBITER_KEYPAIR_B58')
  const program = makeArbiter(arbiter, RPC)
  console.error(`[${NAME}] ready: wallet=${arbiter.publicKey.toBase58()} refundOnReject=${REFUND_ON_REJECT}`)

  while (true) {
    try {
      const mention = await ctx.waitForMention()
      if (!mention) continue
      const review = parseArbiterReview(mention.text.trim())
      if (!review) continue

      if (trace) console.error(`[${NAME}] reviewing round ${review.round} ${review.service} ${review.arg}`)
      const outcome = await decideArbitration(review)
      await ctx.reply(mention, formatArbiterDecision(outcome.decision))

      const reference = new PublicKey(review.reference)
      if (outcome.action === 'release') {
        const sig = await arbitrateRelease(program, arbiter, new PublicKey(review.seller), reference)
        console.error(`[${NAME}] round ${review.round}: ARBITER_RELEASED ${expl(sig)}`)
        await ctx.reply(mention, `ARBITER_RELEASED round=${review.round} sig=${sig} settlement=arbiter`)
        continue
      }

      console.error(`[${NAME}] round ${review.round}: ARBITER_REJECTED ${outcome.decision.code}`)
      if (!REFUND_ON_REJECT) continue
      try {
        const sig = await arbitrateRefund(program, arbiter, new PublicKey(review.payer), reference)
        console.error(`[${NAME}] round ${review.round}: ARBITER_REFUNDED ${expl(sig)}`)
        await ctx.reply(mention, `ARBITER_REFUNDED round=${review.round} sig=${sig} settlement=arbiter`)
      } catch (e) {
        await ctx.reply(mention, `ARBITER_REFUND_FAILED round=${review.round} code=refund_failed reason="${safeReason((e as Error).message)}"`)
      }
    } catch (e) {
      console.error(`[${NAME}] loop error: ${e}`)
    }
  }
})
