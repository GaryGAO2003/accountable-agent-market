/**
 * Marketplace starter — the headline example.
 *
 * Launches one session graph: a market buyer + three LLM seller personas. coral-server spawns each
 * as a container; the buyer broadcasts a WANT, the sellers compete with LLM bids, and the winner is
 * settled through the escrow contract. All sellers reuse the seller-agent image and share the receive
 * wallet — differentiation is persona/floor/inventory (set in each coral-agent.toml), not code.
 *
 *   CORAL_SERVER_URL  default http://localhost:5555
 *   CORAL_TOKEN       default dev   (must be in coral.toml [auth] keys)
 *
 * Run from the host after `docker compose up coral`:  npm install && npm start
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = 'default'
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

// ── Load repo-root .env (2 levels up: marketplace → examples → root) ──
function loadEnv(): Record<string, string> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const env: Record<string, string> = { ...(process.env as Record<string, string>) }
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env — rely on process.env */ }
  return env
}

// ── Typed coral option values ──
const str = (value: string) => ({ type: 'string', value })
const f64 = (value: number) => ({ type: 'f64', value })

const agent = (name: string, options: Record<string, unknown>) => ({
  id: { name, version: '0.1.0', registrySourceId: { type: 'local' } },
  name,
  provider: { type: 'local', runtime: 'docker' },
  options,
})

async function main() {
  const env = loadEnv()
  const wallet = env.WALLET
  const keypair = env.BUYER_KEYPAIR_B58
  if (!wallet || !keypair) {
    throw new Error('WALLET and BUYER_KEYPAIR_B58 must be set in .env — run `node scripts/setup.js`')
  }
  const rpc = env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
  const trace = env.TRACE ?? ''

  // LLM provider — the kit uses Venice AI; flip the whole market with LLM_PROVIDER in .env (see LLM.md).
  const llmOpts: Record<string, unknown> = {}
  if (env.VENICE_API_KEY) llmOpts.VENICE_API_KEY = str(env.VENICE_API_KEY)
  if (env.OPENAI_API_KEY) llmOpts.OPENAI_API_KEY = str(env.OPENAI_API_KEY)
  if (env.ANTHROPIC_API_KEY) llmOpts.ANTHROPIC_API_KEY = str(env.ANTHROPIC_API_KEY)
  if (env.DEEPSEEK_API_KEY) llmOpts.DEEPSEEK_API_KEY = str(env.DEEPSEEK_API_KEY)
  if (env.LLM_PROVIDER) llmOpts.LLM_PROVIDER = str(env.LLM_PROVIDER)
  if (env.LLM_MODEL) llmOpts.LLM_MODEL = str(env.LLM_MODEL)
  if (trace) llmOpts.TRACE = str(trace)

  // The market sells one verified product: a TxODDS World Cup read (the `txline` service). Generic
  // services (coingecko/jupiter/news) are no longer routed — the seller image only delivers txline —
  // so the market needs a free devnet TxLINE token to have anything to sell.
  const txlineKey = env.TXLINE_API_KEY
  if (!txlineKey) {
    throw new Error(
      'TXLINE_API_KEY missing — this market sells verified TxODDS World Cup data. Mint a free devnet ' +
      'token with `npm run mint` in examples/txodds, then re-run `npm start`.',
    )
  }

  // Preflight: a brand-new receive wallet can't accept a release below Solana's rent floor
  // (~0.00089 SOL) — the tx fails wholesale and every round ends 'delivered' but never 'settled'.
  // One-off fix: send the WALLET address ~0.01 devnet SOL from any funded wallet, then re-run.
  try {
    const bal = await fetch(rpc, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [wallet] }),
    }).then((r) => r.json() as Promise<{ result?: { value?: number } }>)
    if ((bal.result?.value ?? 0) < 1_000_000) {
      console.warn(`[marketplace] WARNING: seller receive wallet ${wallet} holds <0.001 SOL.`)
      console.warn('[marketplace] Winning bids below the rent floor cannot be released to it — every round')
      console.warn('[marketplace] will stall at DELIVERED. Send it ~0.01 devnet SOL once, then re-run.')
    }
  } catch { /* preflight only — an RPC hiccup should not block the launch */ }

  // Every seller is a txline seller sharing the receive wallet + token; they compete on persona/floor
  // (set per coral-agent.toml), not code. The buyer awards best value and settles the winner via escrow.
  const seller = (name: string) =>
    agent(name, {
      SELLER_WALLET: str(wallet), SOLANA_RPC_URL: str(rpc), AGENT_NAME: str(name),
      SERVICES: str('txline'), TXLINE_API_KEY: str(txlineKey),
      // The deployed devnet arbiter program has a first-come global config (its arbiter key is already
      // taken), so forked kits can't arbiter-settle — SETTLEMENT_MODE=direct flips to the base escrow.
      ...(env.SETTLEMENT_MODE ? { SETTLEMENT_MODE: str(env.SETTLEMENT_MODE) } : {}),
      ...(env.TXLINE_BASE_URL ? { TXLINE_BASE_URL: str(env.TXLINE_BASE_URL) } : {}),
      ...llmOpts,
    })

  const sellers = ['seller-cheap', 'seller-honest', 'seller-premium']

  // Optional broker swarm (ENABLE_BROKER=1, see coral-agents/broker/README.md): the buyer buys from a
  // broker, which resells from the real sellers. Needs a funded broker wallet + seller receive wallets —
  // `node scripts/provision-swarm.js`.
  const brokerWanted = env.ENABLE_BROKER === '1'
  const brokerReady = brokerWanted && !!env.BROKER_KEYPAIR_B58 && !!env.BROKER_WALLET
  if (brokerWanted && !brokerReady) {
    console.warn('[marketplace] ENABLE_BROKER=1 but BROKER_KEYPAIR_B58/BROKER_WALLET missing — run `node scripts/provision-swarm.js`. Skipping broker.')
  }
  const brokerAgents = brokerReady
    ? [agent('broker', {
        BROKER_KEYPAIR_B58: str(env.BROKER_KEYPAIR_B58), BROKER_WALLET: str(env.BROKER_WALLET),
        AGENT_NAME: str('broker'), SOLANA_RPC_URL: str(rpc), UPSTREAM_SELLERS: str(sellers.join(',')),
        ...(env.BROKER_MARGIN_SOL ? { BROKER_MARGIN_SOL: f64(Number(env.BROKER_MARGIN_SOL)) } : {}),
        ...llmOpts,
      })]
    : []
  // Who the buyer shops + the payout wallet it binds the escrow to (F3): the broker if enabled, else the sellers.
  const buyerSellers = brokerReady ? ['broker'] : sellers
  const buyerExpectedWallet = brokerReady ? env.BROKER_WALLET : wallet

  // The buyer shops for the txline read. `fixtures` always returns data; override with BUYER_ARG (e.g.
  // `edge <fixtureId>` for the headline read) or BUYER_ARGS (a csv rotated one per round) once you have
  // a live fixture id.
  const buyerService = env.BUYER_SERVICE ?? 'txline'
  const buyerArg = env.BUYER_ARG ?? 'fixtures'
  const buyerArgs = env.BUYER_ARGS ?? ''

  const buyerOpts: Record<string, unknown> = {
    BUYER_KEYPAIR_B58: str(keypair),
    // Arbiter settlement is the default path — the buyer crashes at startup without the arbiter key.
    ...(env.ARBITER_KEYPAIR_B58 ? { ARBITER_KEYPAIR_B58: str(env.ARBITER_KEYPAIR_B58) } : {}),
    AGENT_NAME: str('buyer-agent'),
    SOLANA_RPC_URL: str(rpc),
    // F3: the expected seller payout wallet — the buyer binds the escrow seller= to it (broker if enabled).
    SELLER_WALLET: str(buyerExpectedWallet),
    BUYER_MAX_SOL: f64(Number(env.BUYER_MAX_SOL ?? '0.001')),
    BUYER_SERVICE: str(buyerService),
    BUYER_ARG: str(buyerArg),
    ...(buyerArgs ? { BUYER_ARGS: str(buyerArgs) } : {}),
    MARKET_SELLERS: str(buyerSellers.join(',')),
    ...llmOpts,
  }

  // coral-server spawns one container per agent in this graph. Docs:
  //   create-session   https://docs.coralos.ai/api-reference/local/create-session
  //   agent graph      https://docs.coralos.ai/api-reference/models/GraphAgentRequest
  const sres = await fetch(`${BASE}/api/v1/local/session`, {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({
      agentGraphRequest: {
        agents: [
          agent('buyer-agent', buyerOpts),
          seller('seller-cheap'),
          seller('seller-honest'),
          seller('seller-premium'),
          ...brokerAgents,
        ],
      },
      namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
      execution: { mode: 'immediate' },
    }),
  })
  if (!sres.ok) throw new Error(`session create failed: ${sres.status} ${await sres.text()}`)
  const { sessionId } = await sres.json() as { sessionId: string }

  const lineup = brokerReady ? `broker (reselling ${sellers.join(', ')})` : sellers.join(', ')
  console.log(`\n✅ Market session ${sessionId} — buyer + ${lineup}.`)
  console.log(`   receive wallet: ${wallet}`)
  console.log('   The buyer broadcasts a WANT; sellers bid; the winner settles via escrow.\n')
  console.log('   Watch the market:')
  console.log('     docker logs -f buyer-agent      # WANT → AWARD (with a reason) → DEPOSITED → RELEASED')
  console.log('     docker logs -f seller-cheap     # BID → ESCROW_REQUIRED → DELIVERED')
  console.log('   Set TRACE=1 in .env to see the coral_* calls + Explorer links for deposit/release.\n')
}

main().catch((e) => { console.error(`[marketplace] ${e}`); process.exitCode = 1 })
