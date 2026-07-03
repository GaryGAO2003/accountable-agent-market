# coral-agents

Dockerized agents for the CoralOS round in [`examples/txodds/coral/`](../examples/txodds/coral) and
the marketplace in [`examples/marketplace/`](../examples/marketplace). Each agent connects to a
CoralOS MCP session through `startCoralAgent` and trades in a shared market thread.

| Agent | Role |
|---|---|
| `buyer-agent` | Broadcasts `WANT`, collects competing bids, awards best value, opens arbiter escrow, and triggers arbiter release on delivery. |
| `seller-agent` | TxODDS fulfillment image: bids on `txline`, verifies the funded escrow, and delivers the read. |
| `seller-worldcup` | Config persona reusing `seller-agent:0.1.0`; the World Cup specialist for the single-round TxODDS example (`examples/txodds/coral`). |
| `seller-cheap` · `seller-honest` · `seller-premium` | Marketplace persona manifests reusing `seller-agent:0.1.0` — low-price, fair-price, and high-confidence bidding voices; launched by `examples/marketplace/start.ts`. |
| `seller-rogue` | The accountability test dummy (also reuses `seller-agent:0.1.0`): undercuts to win, verifies the funded escrow, then never delivers (`DELIVER_MODE=none`) — so the buyer's deadline refund has something real to catch. |

Settlement for the TxODDS round is arbiter-gated by default: the buyer funds a vault PDA, the seller
verifies that vault-backed escrow, and the neutral arbiter key releases payment after delivery.

## Build

```sh
bash build-agents.sh
```

The TxODDS round launcher (`examples/txodds/coral`) creates one buyer and three seller instances.
`seller-fast` and `seller-premium` reuse the local `seller-worldcup` package id but run with different
`AGENT_NAME`, `PERSONA`, and `FLOOR_SOL` options.
