import {
  verifyDelivery,
  type ChallengeReview,
  type VerificationResult,
  type VerifyOptions,
} from '@pay/agent-runtime'

export type ChallengeAction = 'open' | 'pass'
export type VerifyFn = (
  want: { service: string; arg: string },
  rawDelivery: string,
  opts?: VerifyOptions,
) => Promise<VerificationResult>

export interface ChallengeOutcome {
  action: ChallengeAction
  verification: VerificationResult
}

export async function decideChallenge(
  review: ChallengeReview,
  verify: VerifyFn = verifyDelivery,
  opts: VerifyOptions = {},
): Promise<ChallengeOutcome> {
  const verification = await verify({ service: review.service, arg: review.arg }, review.raw, opts)
  return {
    verification,
    action: verification.ok ? 'pass' : 'open',
  }
}
