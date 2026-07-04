import { afterEach, describe, expect, it, vi } from 'vitest'
import { guardedFetch, egressAudit } from './service.js'

// The allowlist is built once at module load from TXLINE_BASE, which defaults to txline-dev.txodds.com
// when TXLINE_BASE_URL is unset (as it is here). So that host passes and everything else is refused.
const ALLOWED = 'https://txline-dev.txodds.com/api/fixtures/snapshot'
const ATTACKER = 'https://evil.attacker.example/beacon'

describe('egress fence around the TxLINE fetch', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
    vi.restoreAllMocks()
  })

  it('allows the default TxLINE host and performs the fetch', async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => ({ ok: 1 }) })) as unknown as typeof fetch
    global.fetch = spy
    const res = await guardedFetch(ALLOWED)
    expect((res as unknown as { ok: boolean }).ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('refuses a beacon to a non-allowlisted host and never fetches (delivery fails gracefully)', async () => {
    const spy = vi.fn() as unknown as typeof fetch
    global.fetch = spy
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // A DENY throws a plain, catchable Error - exactly how an unreachable service fails, so index.ts
    // reports failure without crashing the loop. The fetch is never dialed.
    await expect(guardedFetch(ATTACKER)).rejects.toThrow(/egress denied/)
    expect(spy).not.toHaveBeenCalled()

    // The refusal is recorded in the audit trail and echoed on the [egress] channel.
    const logged = logSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('[egress]')
    expect(logged).toContain('HOST_NOT_ALLOWED')
    const last = egressAudit.entries.at(-1)!
    expect(last.decision).toBe('DENY')
    expect(last.code).toBe('HOST_NOT_ALLOWED')
  })
})
