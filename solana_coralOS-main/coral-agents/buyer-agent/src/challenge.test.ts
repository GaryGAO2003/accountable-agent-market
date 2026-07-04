import { describe, expect, it } from 'vitest'
import { planChallengeWindow } from './challenge.js'

describe('planChallengeWindow', () => {
  it('opens a challenge when objective re-exec fails', async () => {
    const plan = await planChallengeWindow(
      { service: 'txline', arg: 'fixtures' },
      '{"bad":true}',
      { round: 1, challengeWindowMs: 5000, autoChallenge: true },
      async () => ({ ok: false, code: 'txline_count_mismatch', reason: 'count differs' }),
    )

    expect(plan).toEqual({
      action: 'challenge',
      verification: { ok: false, code: 'txline_count_mismatch', reason: 'count differs' },
      reason: 'count differs',
    })
  })

  it('waits through the optimistic window when re-exec passes', async () => {
    const plan = await planChallengeWindow(
      { service: 'txline', arg: 'fixtures' },
      '{"service":"txline-fixtures"}',
      { round: 1, challengeWindowMs: 5000, autoChallenge: true },
      async () => ({ ok: true, code: 'txline_fixtures_match', reason: 'matched' }),
    )

    expect(plan).toEqual({
      action: 'wait',
      waitMs: 5000,
      verification: { ok: true, code: 'txline_fixtures_match', reason: 'matched' },
    })
  })

  it('can run as a pure optimistic timer without pre-verification', async () => {
    const plan = await planChallengeWindow(
      { service: 'txline', arg: 'fixtures' },
      '{}',
      { round: 1, challengeWindowMs: 3000, autoChallenge: false },
      async () => { throw new Error('should not verify') },
    )

    expect(plan).toEqual({ action: 'wait', waitMs: 3000 })
  })
})
