import { describe, expect, it, vi } from 'vitest'
import { verifyDelivery } from './verify.js'

const txlineFetch = (fixtures: unknown, odds: unknown): typeof fetch =>
  vi.fn(async (url: string) => {
    if (url.endsWith('/auth/guest/start')) return { ok: true, json: async () => ({ token: 'jwt' }) }
    if (url.includes('/api/fixtures/snapshot')) return { ok: true, json: async () => fixtures }
    if (url.includes('/api/odds/snapshot/123')) return { ok: true, json: async () => odds }
    return { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch

describe('verifyDelivery objective re-exec', () => {
  it('accepts a txline fixtures delivery when re-exec sees the same fixture count', async () => {
    const result = await verifyDelivery(
      { service: 'txline', arg: 'fixtures' },
      JSON.stringify({ service: 'txline-fixtures', count: 2, fixtures: [{ FixtureId: 1 }, { FixtureId: 2 }] }),
      { fetch: txlineFetch([{ FixtureId: 1 }, { FixtureId: 2 }], []), txlineApiKey: 'token', txlineBaseUrl: 'https://txline.test' },
    )

    expect(result).toEqual({
      ok: true,
      code: 'txline_fixtures_match',
      reason: 're-exec matched 2 fixtures',
    })
  })

  it('rejects a txline fixtures delivery when re-exec sees a different count', async () => {
    const result = await verifyDelivery(
      { service: 'txline', arg: 'fixtures' },
      JSON.stringify({ service: 'txline-fixtures', count: 3, fixtures: [{ FixtureId: 1 }] }),
      { fetch: txlineFetch([{ FixtureId: 1 }, { FixtureId: 2 }], []), txlineApiKey: 'token', txlineBaseUrl: 'https://txline.test' },
    )

    expect(result.ok).toBe(false)
    expect(result.code).toBe('txline_count_mismatch')
  })

  it('accepts a txline edge delivery when objective teams and 1X2 market match re-exec', async () => {
    const market = { SuperOddsType: '1X2', PriceNames: ['part1', 'x', 'part2'], Pct: ['62', '22', '16'] }
    const result = await verifyDelivery(
      { service: 'txline', arg: 'edge 123' },
      JSON.stringify({
        service: 'txline-edge',
        fixtureId: '123',
        teams: { home: 'A', away: 'B', competition: 'World Cup' },
        market,
        analysis: { call: 'A', confidence: 0.62 },
      }),
      {
        fetch: txlineFetch(
          [{ FixtureId: 123, Participant1: 'A', Participant2: 'B', Competition: 'World Cup' }],
          [market],
        ),
        txlineApiKey: 'token',
        txlineBaseUrl: 'https://txline.test',
      },
    )

    expect(result).toEqual({
      ok: true,
      code: 'txline_edge_match',
      reason: 're-exec matched fixture 123 teams and 1X2 market',
    })
  })

  it('rejects invalid JSON instead of releasing escrow', async () => {
    const result = await verifyDelivery(
      { service: 'txline', arg: 'fixtures' },
      'not json',
      { fetch: txlineFetch([], []), txlineApiKey: 'token', txlineBaseUrl: 'https://txline.test' },
    )

    expect(result.ok).toBe(false)
    expect(result.code).toBe('invalid_delivery_json')
  })
})
