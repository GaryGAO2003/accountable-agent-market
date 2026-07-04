import { verifyDelivery, type VerificationResult, type VerifyOptions } from '@pay/agent-runtime'

export type ChallengePlan =
  | { action: 'wait'; waitMs: number; verification?: VerificationResult }
  | { action: 'challenge'; verification: VerificationResult; reason: string }

export type VerifyFn = (
  want: { service: string; arg: string },
  rawDelivery: string,
  opts?: VerifyOptions,
) => Promise<VerificationResult>

export async function planChallengeWindow(
  want: { service: string; arg: string },
  rawDelivery: string,
  opts: { round: number; challengeWindowMs: number; autoChallenge: boolean },
  verify: VerifyFn = verifyDelivery,
): Promise<ChallengePlan> {
  if (!opts.autoChallenge) return { action: 'wait', waitMs: opts.challengeWindowMs }
  const verification = await verify(want, rawDelivery)
  if (!verification.ok) return { action: 'challenge', verification, reason: verification.reason }
  return { action: 'wait', waitMs: opts.challengeWindowMs, verification }
}
