# buyer-agent

The marketplace buyer broadcasts a `WANT`, collects competing seller bids, awards the best value, and
settles the winner through the arbiter-gated escrow by default.

```text
WANT -> BID* -> AWARD
  -> ESCROW_REQUIRED settlement=arbiter reference=<bound order>
  -> ARBITER_OPENED / DEPOSITED vault=<vault PDA>
  -> DELIVERED
  -> VERIFIED / CHALLENGE_OPENED
  -> RELEASED / ARBITER_RELEASED / ARBITER_SLASHED
```

With `ARBITER_AGENT_ENABLED=1`, the buyer delegates the final judgment to `arbiter-agent` instead of
releasing itself:

```text
DELIVERED -> VERIFIED -> ARBITER_REVIEW -> ARBITER_VERIFIED -> CHALLENGE_REJECTED -> ARBITER_RELEASED
DELIVERED_BAD -> CHALLENGE_OPENED -> ARBITER_REVIEW -> ARBITER_REJECTED -> CHALLENGE_UPHELD -> ARBITER_SLASHED
```

With `CHALLENGER_AGENT_ENABLED=1`, the buyer no longer self-opens failed-verification challenges.
Instead it sends `CHALLENGE_REVIEW` to `challenger-agent` during the optimistic window and waits for a
separate `CHALLENGE_OPENED by=challenger-agent challenger=<wallet> bondSig=<tx>`.

> **CoralOS docs:** these messages ride Coral threads with `@mentions`
> ([Threads](https://docs.coralos.ai/concepts/threads)); the buyer blocks on bids and waits for sellers
> to come online via [Coordination](https://docs.coralos.ai/concepts/coordination), all inside a
> [Session](https://docs.coralos.ai/concepts/sessions). End-to-end wiring: [/CORAL.md](../../CORAL.md).

`SETTLEMENT_MODE=direct` keeps the legacy base escrow path available, but the TxODDS CoralOS round uses
`SETTLEMENT_MODE=arbiter` so the buyer cannot unilaterally claw back after delivery.

## Files

| File | Role |
|---|---|
| `src/index.ts` | Market loop: WANT, bid collection, award, arbiter open, delivery wait, verify, release |
| `src/arbiter.ts` | Arbiter wrapper client: config, vault PDA, open, release |
| `src/escrow.ts` | Legacy direct base escrow client |
| `src/guard.ts` | Seller payout binding and legacy payment guards |
| `src/verify.ts` | Compatibility re-export of the shared TxLINE objective re-exec verifier |

## Env

`BUYER_KEYPAIR_B58` funds the order. `ARBITER_KEYPAIR_B58` signs arbiter release/refund.
`ARBITER_PROGRAM_ID` can point to a checkout-owned arbiter wrapper deployment; its on-chain config
must be initialized to the `ARBITER_KEYPAIR_B58` public key, otherwise startup fails before escrow is
opened to avoid a late `NotArbiter`.
`SELLER_WALLET` binds the payout wallet. `BUYER_SERVICE` defaults to `txline`, `BUYER_ARG` defaults to
an `edge <fixtureId>` style request, and `MARKET_SELLERS` controls the competing sellers.
Set `ARBITER_AGENT_ENABLED=1` to include `ARBITER_AGENT_NAME` in the market thread and send
`ARBITER_REVIEW` after delivery.
Set `CHALLENGER_AGENT_ENABLED=1` to include `CHALLENGER_AGENT_NAME` and make the challenge role a
separate CoralOS actor.
`CHALLENGE_WINDOW_MS` controls the optimistic wait before no-challenge release, and
`AUTO_CHALLENGE_ON_FAILED_VERIFY=1` makes failed objective re-exec emit `CHALLENGE_OPENED`.
`SELLER_BOND_SOL` is used when a buyer-handled challenge must slash the transfer-backed bond.

For best-value bid selection set an LLM key — the kit's LLM is **Venice AI** (`LLM_PROVIDER=venice` +
`VENICE_API_KEY`; new accounts get $50 free via code `IMPERIAL50` at
[venice.ai/settings/api](https://venice.ai/settings/api)). `ANTHROPIC_API_KEY`, or `LLM_PROVIDER=openai`
+ `OPENAI_API_KEY`, also work. Without a live key, selection falls back to the cheapest valid bid. See
[LLM.md](../../LLM.md).

## Test

```sh
npm install
npm run typecheck
npm test
```

Live settlement signs devnet transactions and is exercised through `examples/txodds/coral`.
