# coral-agents

Dockerized agents for the CoralOS round in [`examples/txodds/coral/`](../examples/txodds/coral) and
the marketplace in [`examples/marketplace/`](../examples/marketplace). Each agent connects to a
CoralOS MCP session through `startCoralAgent` and trades in a shared market thread.

| Agent | Role |
|---|---|
| `buyer-agent` | Broadcasts `WANT`, collects competing bids, awards best value, opens arbiter escrow, and either verifies/releases itself or delegates to `arbiter-agent`. |
| `arbiter-agent` | Neutral verifier: consumes `ARBITER_REVIEW`, re-executes the TxLINE predicate, emits `ARBITER_VERIFIED` / `ARBITER_REJECTED`, and signs release/refund. |
| `seller-agent` | TxODDS fulfillment image: bids on `txline`, verifies the funded escrow, and delivers the read. |
| `seller-worldcup` | Config persona reusing `seller-agent:0.1.0`; the World Cup specialist for the single-round TxODDS example (`examples/txodds/coral`). |
| `seller-cheap` · `seller-honest` · `seller-premium` | Marketplace persona manifests reusing `seller-agent:0.1.0` — low-price, fair-price, and high-confidence bidding voices; launched by `examples/marketplace/start.ts`. |

Settlement for the TxODDS round is arbiter-gated by default: the buyer funds a vault PDA, the seller
verifies that vault-backed escrow, and either the buyer or `arbiter-agent` uses the neutral arbiter key
to release payment after objective verification.

## Build

```sh
bash build-agents.sh
```

The TxODDS round launcher (`examples/txodds/coral`) creates one buyer and three seller instances.
`seller-fast` and `seller-premium` reuse the local `seller-worldcup` package id but run with different
`AGENT_NAME`, `PERSONA`, and `FLOOR_SOL` options.
