import {
  verifyDelivery,
  type ArbiterDecision,
  type ArbiterReview,
  type VerificationResult,
  type VerifyOptions,
} from '@pay/agent-runtime'

export type SettlementAction = 'release' | 'reject'
export type VerifyFn = (
  want: { service: string; arg: string },
  rawDelivery: string,
  opts?: VerifyOptions,
) => Promise<VerificationResult>

export interface ArbitrationOutcome {
  decision: ArbiterDecision
  action: SettlementAction
}

export async function decideArbitration(
  review: ArbiterReview,
  verify: VerifyFn = verifyDelivery,
  opts: VerifyOptions = {},
): Promise<ArbitrationOutcome> {
  const result = await verify({ service: review.service, arg: review.arg }, review.raw, opts)
  return {
    decision: {
      round: review.round,
      ok: result.ok,
      code: result.code,
      reason: result.reason,
    },
    action: result.ok ? 'release' : 'reject',
  }
}
