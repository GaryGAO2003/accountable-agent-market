import {
  formatChallengeOpened,
  loadKeypairB58,
  parseChallengeReview,
  startCoralAgent,
} from '@pay/agent-runtime'
import { decideChallenge } from './decision.js'
import { postChallengeBond } from './bond.js'

const NAME = process.env.AGENT_NAME ?? 'challenger-agent'
const BOND_HOLDER_WALLET = process.env.BOND_HOLDER_WALLET ?? process.env.ARBITER_WALLET ?? ''
const CHALLENGER_BOND_SOL = Number(process.env.CHALLENGER_BOND_SOL ?? '0.0001')
const MAX_CHALLENGER_BOND_SOL = Number(process.env.MAX_CHALLENGER_BOND_SOL ?? '0.01')
const trace = process.env.TRACE === '1'

await startCoralAgent({ agentName: NAME }, async (ctx) => {
  const challenger = CHALLENGER_BOND_SOL > 0 ? loadKeypairB58('CHALLENGER_KEYPAIR_B58') : null
  const challengerWallet = challenger ? challenger.publicKey.toBase58() : 'bond-disabled'
  console.error(`[${NAME}] ready: wallet=${challengerWallet} bond=${CHALLENGER_BOND_SOL} holder=${BOND_HOLDER_WALLET}`)

  while (true) {
    try {
      const mention = await ctx.waitForMention()
      if (!mention) continue
      const review = parseChallengeReview(mention.text.trim())
      if (!review) continue

      const outcome = await decideChallenge(review)
      if (outcome.action === 'pass') {
        if (trace) console.error(`[${NAME}] round ${review.round}: no challenge (${outcome.verification.code})`)
        continue
      }

      const bondSig = await postChallengeBond({
        holderWallet: BOND_HOLDER_WALLET,
        amountSol: CHALLENGER_BOND_SOL,
        maxSol: MAX_CHALLENGER_BOND_SOL,
        ...(challenger ? { keypair: challenger } : {}),
      })
      await ctx.reply(mention, formatChallengeOpened({
        round: review.round,
        by: NAME,
        reason: outcome.verification.reason,
        ...(challenger ? { challenger: challenger.publicKey.toBase58() } : {}),
        ...(bondSig ? { bondSig } : {}),
      }))
      console.error(`[${NAME}] round ${review.round}: CHALLENGE_OPENED code=${outcome.verification.code}`)
    } catch (e) {
      console.error(`[${NAME}] loop error: ${e}`)
    }
  }
})
