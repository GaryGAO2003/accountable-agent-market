import { describe, expect, it, vi } from 'vitest'
import { decideChallenge } from './decision.js'
import type { ChallengeReview, VerificationResult } from '@pay/agent-runtime'

const review: ChallengeReview = {
  round: 7,
  service: 'txline',
  arg: 'fixtures',
  raw: '{"service":"txline-fixtures","count":13}',
}

describe('decideChallenge', () => {
  it('passes when objective re-exec matches delivery', async () => {
    const verify = vi.fn(async (): Promise<VerificationResult> => ({
      ok: true,
      code: 'txline_fixtures_match',
      reason: 're-exec matched 12 fixtures',
    }))

    const outcome = await decideChallenge(review, verify)

    expect(verify).toHaveBeenCalledWith({ service: 'txline', arg: 'fixtures' }, review.raw, {})
    expect(outcome.action).toBe('pass')
    expect(outcome.verification.ok).toBe(true)
  })

  it('opens a challenge when objective re-exec rejects delivery', async () => {
    const verify = vi.fn(async (): Promise<VerificationResult> => ({
      ok: false,
      code: 'txline_count_mismatch',
      reason: 'delivered count 13 != re-exec count 12',
    }))

    const outcome = await decideChallenge(review, verify)

    expect(outcome.action).toBe('open')
    expect(outcome.verification.code).toBe('txline_count_mismatch')
  })
})
