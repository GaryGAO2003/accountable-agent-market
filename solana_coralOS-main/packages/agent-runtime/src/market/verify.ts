export interface DeliveryWant {
  service: string
  arg: string
}

export interface VerificationResult {
  ok: boolean
  code: string
  reason: string
}

export interface VerifyOptions {
  fetch?: typeof fetch
  txlineApiKey?: string
  txlineBaseUrl?: string
}

const TXLINE_BASE = process.env.TXLINE_BASE_URL || 'https://txline-dev.txodds.com'

const fail = (code: string, reason: string): VerificationResult => ({ ok: false, code, reason })
const pass = (code: string, reason: string): VerificationResult => ({ ok: true, code, reason })

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function same(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function txlineRequest(arg: string): { action: 'fixtures' | 'odds' | 'edge'; fixtureId?: string } {
  const tokens = arg.trim().split(/\s+/).filter(Boolean)
  let action = (tokens[0] ?? 'fixtures').toLowerCase()
  let fixtureId = tokens[1]
  if (/^\d+$/.test(action)) {
    fixtureId = action
    action = 'edge'
  }
  if (action === 'odds' || action === 'edge') return { action, fixtureId }
  return { action: 'fixtures' }
}

async function txlineGet(path: string, opts: VerifyOptions): Promise<unknown> {
  const apiToken = opts.txlineApiKey ?? process.env.TXLINE_API_KEY
  if (!apiToken) throw new Error('TXLINE_API_KEY not set')
  const doFetch = opts.fetch ?? fetch
  const base = opts.txlineBaseUrl ?? TXLINE_BASE
  const auth = await doFetch(`${base}/auth/guest/start`, { method: 'POST' })
  if (!auth.ok) throw new Error(`txline auth ${auth.status}`)
  const jwt = ((await auth.json()) as { token: string }).token
  const res = await doFetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken },
  })
  if (!res.ok) throw new Error(`txline ${path} ${res.status}`)
  return res.json()
}

function teamsFromFixture(fixtures: unknown, fixtureId: string | undefined): unknown {
  if (!Array.isArray(fixtures)) return undefined
  const fx = (fixtures as Array<Record<string, unknown>>).find((f) => String(f.FixtureId) === String(fixtureId))
  return fx ? { home: fx.Participant1, away: fx.Participant2, competition: fx.Competition } : undefined
}

function oneX2Market(odds: unknown): unknown {
  return Array.isArray(odds)
    ? (odds as Array<Record<string, unknown>>).find((x) => String(x.SuperOddsType ?? '').includes('1X2'))
    : undefined
}

export async function verifyDelivery(
  want: DeliveryWant,
  rawDelivery: string,
  opts: VerifyOptions = {},
): Promise<VerificationResult> {
  if (want.service !== 'txline') return fail('unsupported_service', `no verifier for service ${want.service}`)

  let delivered: Record<string, unknown>
  try {
    const parsed = JSON.parse(rawDelivery)
    const rec = asRecord(parsed)
    if (!rec) return fail('invalid_delivery_json', 'delivery is not a JSON object')
    delivered = rec
  } catch {
    return fail('invalid_delivery_json', 'delivery is not parseable JSON')
  }

  try {
    const req = txlineRequest(want.arg)
    if (req.action === 'fixtures') {
      const fixtures = await txlineGet('/api/fixtures/snapshot', opts)
      const count = Array.isArray(fixtures) ? fixtures.length : 0
      if (delivered.service !== 'txline-fixtures') {
        return fail('txline_service_mismatch', 'delivery is not a txline fixtures payload')
      }
      if (delivered.count !== count) {
        return fail('txline_count_mismatch', `delivered count ${delivered.count} != re-exec count ${count}`)
      }
      return pass('txline_fixtures_match', `re-exec matched ${count} fixtures`)
    }

    if (!req.fixtureId) return fail('txline_missing_fixture', `${req.action} verification needs a fixture id`)

    if (req.action === 'odds') {
      const odds = await txlineGet(`/api/odds/snapshot/${req.fixtureId}`, opts)
      if (delivered.service !== 'txline-odds' || String(delivered.fixtureId) !== String(req.fixtureId)) {
        return fail('txline_service_mismatch', 'delivery is not the requested txline odds payload')
      }
      if (!same(delivered.odds, odds)) {
        return fail('txline_odds_mismatch', `odds snapshot differs for fixture ${req.fixtureId}`)
      }
      return pass('txline_odds_match', `re-exec matched odds for fixture ${req.fixtureId}`)
    }

    const [odds, fixtures] = await Promise.all([
      txlineGet(`/api/odds/snapshot/${req.fixtureId}`, opts),
      txlineGet('/api/fixtures/snapshot', opts),
    ])
    const expectedTeams = teamsFromFixture(fixtures, req.fixtureId)
    const expectedMarket = oneX2Market(odds)
    if (delivered.service !== 'txline-edge' || String(delivered.fixtureId) !== String(req.fixtureId)) {
      return fail('txline_service_mismatch', 'delivery is not the requested txline edge payload')
    }
    if (!same(delivered.teams, expectedTeams)) {
      return fail('txline_teams_mismatch', `teams differ for fixture ${req.fixtureId}`)
    }
    if (!same(delivered.market, expectedMarket)) {
      return fail('txline_market_mismatch', `1X2 market differs for fixture ${req.fixtureId}`)
    }
    return pass('txline_edge_match', `re-exec matched fixture ${req.fixtureId} teams and 1X2 market`)
  } catch (e) {
    return fail('txline_reexec_error', (e as Error).message)
  }
}
