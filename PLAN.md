# PLAN — Accountable Agent Market: version 0.1 and beyond

Last updated: 2026-07-03 (Windows machine). Companion docs: `progress.md` (teammate's Mac work — the code
changes there were lost; only the doc reached the Test branch), `coral_info.txt`, `CRITIQUE.md`.

## Where we are (verified against the code, not just progress.md)

- `solana_coralOS-main/` is a pristine upstream clone of `trilltino/solana_coralOS` @ `a8fd71a`.
  Green baseline on this machine: `packages/agent-runtime` builds + **35/35 tests**; `examples/marketplace/feed`
  **8/8 tests** + typecheck clean.
- **Launch blocker (upstream bug):** `examples/marketplace/start.ts:87` launches
  `['seller-worldcup', 'seller-cheap', 'seller-premium']`, but `coral-agents/` has **no**
  `seller-cheap`/`seller-premium` folders → session creation fails. coral-server auto-discovers any
  `coral-agents/*/coral-agent.toml` (mounted in `docker-compose.yml:46`, rescan every 5s), so the fix is
  one TOML per persona reusing the prebuilt `seller-agent:0.1.0` image — no Dockerfile, no rebuild.
- **Live-demo bug (upstream):** default settlement is **arbiter** (`SETTLEMENT_MODE` defaults to `arbiter`),
  so the buyer emits `ARBITER_RELEASED` (`coral-agents/buyer-agent/src/index.ts:184`) — but the dashboard
  feed folds only literal `RELEASED` (`examples/marketplace/feed/src/foldRounds.ts:90`). A live default
  session therefore **never shows rounds as settled**. Current tests pass only because the recorded fixture
  uses legacy `RELEASED`.
- Stale naming: `feed/src/server.ts:33` default roster is `seller-cheap,seller-premium,seller-lazy`;
  `web/tests/*` fixtures still use the old `seller-lazy` era names.

## v0.1 scope — restore progress.md "Recent Changes", verified by tests

> **Status: SHIPPED 2026-07-03** — tag `v0.1` on `main`. All gates green: agent-runtime 35/35,
> feed 9/9 + typecheck, marketplace typecheck, web 5/5 + typecheck, TOML ×3 parsed. Task A's test
> file was adopted verbatim from the teammate's upload on `origin/Test` (bbeb66b). Repo renamed to
> `accountable-agent-market` (old URL redirects).

### Task A — feed folds `ARBITER_RELEASED` (fixes the live-demo bug)
- Files: `examples/marketplace/feed/src/foldRounds.ts`, `foldRounds.test.ts`.
- Change: extend the `v === 'RELEASED'` arm to also accept `'ARBITER_RELEASED'` — same `sig=(\S+)`
  extraction, same `round.release = { sig }`, `status = 'settled'`. No protocol/parser changes.
- Test: mirror the existing `'folds a full round to settled with parsed fields'` case
  (`foldRounds.test.ts:18`) with message `ARBITER_RELEASED round=1 sig=3PMa settlement=arbiter`.
- Accept: feed `npm test` = 9 passed; `npm run typecheck` clean.

### Task B — three seller personas + roster
- New files (mirror `coral-agents/seller-worldcup/coral-agent.toml`; `[agent] version = "0.1.0"`;
  `[runtimes.docker] image = "seller-agent:0.1.0"`):
  - `coral-agents/seller-cheap/coral-agent.toml`
  - `coral-agents/seller-honest/coral-agent.toml`
  - `coral-agents/seller-premium/coral-agent.toml`
- Persona defaults in `[options]` (all `SERVICES = "txline"`, `AGENT_NAME = <persona>`; all floors below the
  buyer's default `BUYER_MAX_SOL = 0.001` so all three can bid):

  | persona | FLOOR_SOL | PERSONA (LLM bidding voice) |
  |---|---|---|
  | seller-cheap | 0.0003 | low-price, volume-seeking TxODDS seller |
  | seller-honest | 0.0005 | fair-price, reliable TxODDS seller |
  | seller-premium | 0.0008 | higher-price, high-confidence TxODDS seller |

- Edit `examples/marketplace/start.ts` roster (line 87 + the agent graph) →
  `['seller-cheap', 'seller-honest', 'seller-premium']` (drop `seller-worldcup` from the *marketplace*
  roster per progress.md; it remains a documented specialist example).
- Edit `feed/src/server.ts:33` default `MARKET_SELLERS` → `seller-cheap,seller-honest,seller-premium`.
- Accept: all three TOMLs parse (python `tomllib`); `examples/marketplace` `npm run typecheck`;
  feed tests still green.

### Task C — dashboard/fixture alignment (consistency, low risk)
- `web/tests/fixtures.ts`, `web/tests/market.spec.ts`, `web/src/components/RoundCard.test.tsx`:
  replace the stale `seller-lazy`-era names with the new roster, preserving scenario semantics
  (winner/declined roles).
- `examples/marketplace/README.md`, `coral-agents/README.md`: document the 3-persona roster;
  `seller-worldcup` stays documented as the specialist example.
- Deliberately unchanged: `feed/tests/coral-session.json` (recorded historical transcript).
- Accept: `web` `npm test` (vitest + jsdom, browserless) green + `npm run typecheck`.
  Playwright e2e (`npm run e2e`) deferred — needs `npx playwright install chromium`; optional gate.

### Task D — git baseline + versioning (makes the work un-losable, unlike the Mac copy)
1. Commit parent-repo housekeeping (`bounties` → `coral_info.txt` move; `CRITIQUE.md` — confirm it should
   be committed).
2. Vendor the pristine upstream tree **before** any edits: remove `solana_coralOS-main/.git`
   (provenance: upstream @ `a8fd71a`, recorded here), `git add solana_coralOS-main`, commit.
   The nested `.gitignore` keeps `node_modules/`, `dist/`, `.env` out; generated `package-lock.json`
   files DO get committed (reproducible installs).
3. Commit Tasks A/B/C as separate commits on top; tag `v0.1`; push `origin main`.
- Teammate coordination: v0.1 re-implements progress.md's "Recent Changes" — don't re-push the Mac
  originals; pull and diff instead. After pulling: `cd packages/agent-runtime && npm install && npm run build`
  (dist is not committed).

## Verification gates (run centrally after the coder tasks return)
- `packages/agent-runtime`: `npm test` — regression, expect 35/35.
- `feed`: `npm test` expect 9/9 + `npm run typecheck`.
- `examples/marketplace`: `npm install --ignore-scripts` + `npm run typecheck`.
- `web`: `npm install --ignore-scripts` + `npm test` + `npm run typecheck`.
- TOML: parse all three manifests with python `tomllib`.
- Constraint (session policy): **every npm install in this repo uses `--ignore-scripts`**.

## E2E readiness checklist (gated on resources; can run in parallel with v0.2)
1. Docker Desktop running (WSL2) — compose mounts `docker.sock` + `coral-agents/`.
2. `node scripts/setup.js` → `.env` wallets; fund the buyer at faucet.solana.com;
   `ARBITER_KEYPAIR_B58` present (arbiter is the default settlement path).
3. An LLM key: `VENICE_API_KEY` (free credits) or OpenAI/Anthropic + `LLM_PROVIDER`.
4. `TXLINE_API_KEY` minted (`npm run mint` in `examples/txodds`) — `start.ts` throws without it.
5. `bash build-agents.sh` (Git Bash) → builds `seller-agent:0.1.0` + `buyer-agent:0.1.0`.
6. `docker compose up -d coral`; `cd examples/marketplace && npm install --ignore-scripts && npm start`;
   feed with `SESSION=<id>` + `MARKET_SELLERS=seller-cheap,seller-honest,seller-premium`; `web` `npm run dev`.
- Acceptance (= progress.md "Potential Next Checks"): clean 3-persona launch; a **live** `ARBITER_RELEASED`
  round folds to `settled` on the dashboard; `ARBITER_KEYPAIR_B58` forwarding verified.

## Roadmap after v0.1 (progress.md Phases → versions)
- **v0.2 — Phase 1:** `jupiter_quote` as a second service behind seller `deliverService()`
  (+ tests for supported/unsupported services; txline stays the demo default). Research Jupiter quote API first.
- **v0.2 — Phase 2 (light):** persona knobs (`FLOOR_SOL`/`PERSONA`/`SERVICES`) already cover price/voice;
  extend only if the demo needs more.
- **v0.3 — Phase 3 + 4:** buyer risk-adjusted selection (price/confidence/latency/reputation score, rationale
  emitted into CoralOS messages) + verification adapter (txline first, jupiter second).
- **v0.4 — Phase 5 + 6:** watcher/challenger + arbiter agent (deterministic, evidence-backed; wired to the
  existing arbiter settlement client).
- **v0.5 — Phase 7:** on-chain slashing — decision point: extend the Anchor programs (Rust + redeploy) vs.
  demo-scope simulation via arbiter refund + reputation penalty. Decide after v0.4.
- **v0.6 — Phase 8 + 9:** reputation + full dashboard timeline (rationale, verification, challenges,
  arbiter decisions, slashing signatures, reputation deltas).
- Working model per version: coder agents implement from written specs; every change lands with tests;
  verified centrally before commit.

## Known quirks (documented, not v0.1 blockers)
- `FLOOR_SOL` default mismatch: code `0.0003` (`bidder.ts:31`) vs existing manifests `0.0005` — manifest
  defaults win when launched via coral; Task B sets explicit per-persona values anyway.
- The `SERVICE` option declared in manifests is never read by seller code (only `SERVICES` is) — kept for
  manifest parity with `seller-worldcup`.
- `feed/tests/coral-session.json` deliberately keeps legacy names/verbs (recorded transcript).
