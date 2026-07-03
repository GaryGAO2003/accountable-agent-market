import { describe, expect, it, vi } from 'vitest'
import { decideArbitration } from './decision.js'
import type { ArbiterReview, VerificationResult } from '@pay/agent-runtime'

const review: ArbiterReview = {
  round: 7,
  service: 'txline',
  arg: 'fixtures',
  reference: 'Ref111',
  seller: 'Seller111',
  payer: 'Buyer111',
  raw: '{"service":"txline-fixtures","count":2}',
}

describe('decideArbitration', () => {
  it('turns a successful objective re-exec into an arbiter release decision', async () => {
    const verify = vi.fn(async (): Promise<VerificationResult> => ({
      ok: true,
      code: 'txline_fixtures_match',
      reason: 're-exec matched 2 fixtures',
    }))

    const outcome = await decideArbitration(review, verify)

    expect(verify).toHaveBeenCalledWith({ service: 'txline', arg: 'fixtures' }, review.raw, {})
    expect(outcome).toEqual({
      action: 'release',
      decision: {
        round: 7,
        ok: true,
        code: 'txline_fixtures_match',
        reason: 're-exec matched 2 fixtures',
      },
    })
  })

  it('turns a failed objective re-exec into an arbiter rejection decision', async () => {
    const verify = vi.fn(async (): Promise<VerificationResult> => ({
      ok: false,
      code: 'txline_count_mismatch',
      reason: 'delivered count 3 != re-exec count 2',
    }))

    const outcome = await decideArbitration(review, verify)

    expect(outcome.action).toBe('reject')
    expect(outcome.decision.ok).toBe(false)
    expect(outcome.decision.code).toBe('txline_count_mismatch')
  })
})
