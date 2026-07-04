# seller-agent

The TxODDS fulfillment agent competes in the CoralOS market and delivers verified fair-line reads. It
is intentionally TxODDS-only for the demo; generic CoinGecko/Jupiter/news services are no longer routed
through this seller path.

```text
WANT service=txline arg="edge <fixtureId>"
  -> BID price=<floor-or-LLM-price>
  -> AWARD to=<me>
  -> ESCROW_REQUIRED settlement=arbiter reference=<bound order>
  -> verify funded escrow using vault PDA
  -> BOND_POSTED sig=<devnet transfer>
  -> DELIVERED {teams, odds, analysis}
```

> **CoralOS docs:** the loop is `wait_for_mention → reply` on a shared thread
> ([Threads](https://docs.coralos.ai/concepts/threads),
> [Coordination](https://docs.coralos.ai/concepts/coordination)); coral-server launches this agent into a
> [Session](https://docs.coralos.ai/concepts/sessions) from its
> [manifest](https://docs.coralos.ai/reference/agent). Kit walkthrough: [/CORAL.md](../../CORAL.md).

The seller only delivers after `isFunded` confirms the escrow names its payout wallet and holds at
least the quoted price. In arbiter mode it checks the escrow buyer as the vault PDA from `DEPOSITED`,
not the human buyer wallet.
Before delivery, it posts the small transfer-backed L1 demo bond (`SELLER_BOND_SOL`) to
`BOND_HOLDER_WALLET` / `ARBITER_WALLET`; challenged bad deliveries can then be slashed by
arbiter-agent with a real devnet transfer signature.

## Files

| File | Role |
|---|---|
| `src/index.ts` | Market loop and arbiter-aware funding verification |
| `src/bidder.ts` | LLM bid proposal with code-enforced floor/budget |
| `src/escrow.ts` | Read-only escrow funding check |
| `src/service.ts` | TxODDS delivery: fixtures, odds, edge |

`src/payment.ts` and `src/replay.ts` remain for the older direct-pay helpers and tests, but they are
not part of the TxODDS CoralOS seller loop.

## Env

`SELLER_WALLET`, `SELLER_KEYPAIR_B58`, `BOND_HOLDER_WALLET`, `SELLER_BOND_SOL`, `AGENT_NAME`,
`SERVICES=txline`, `FLOOR_SOL`, `PERSONA`, `SETTLEMENT_MODE=arbiter`, `ESCROW_DEADLINE_SECS`,
`SOLANA_RPC_URL`, and `TXLINE_API_KEY`.

For live analysis set an LLM key — the kit's LLM is **Venice AI** (`LLM_PROVIDER=venice` + `VENICE_API_KEY`;
new accounts get $50 free via code `IMPERIAL50` at [venice.ai/settings/api](https://venice.ai/settings/api)).
`ANTHROPIC_API_KEY`, or `LLM_PROVIDER=openai` + `OPENAI_API_KEY`, also work — no code change. Without a
live key, `service.ts` returns a deterministic odds read and labels it as fallback. See [LLM.md](../../LLM.md).

## Test

```sh
npm install
npm run typecheck
npm test
```
