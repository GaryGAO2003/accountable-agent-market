<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/the-lifecycle-from-registry-to-running-session -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/the-lifecycle-from-registry-to-running-session.md).

# The Lifecycle: from registry to running session

### 1. Register — CoralOS scans a folder

```toml
# config/coral.toml
[registry]
localAgents = ["/agents/*"]       # discover buyer-agent, seller-agent, seller-cheap/-premium/-lazy…
localAgentRescanTimer = "5s"      # re-scan every 5s — drop one in, it appears

[docker]
address = "host.docker.internal"  # launch each as a Docker container
```

Drop a new folder in `coral-agents/` with a `coral-agent.toml`, and CoralOS knows it can launch it. No restart. (The seller personas are config-only manifests that reuse the seller image — that's all a "new agent" needs to be.)

### 2. Start a session — name the graph you want

```ts
// marketplace/start.ts
const agent = (name, options) => ({
  id: { name, version: '0.1.0', registrySourceId: { type: 'local' } },
  name, provider: { type: 'local', runtime: 'docker' }, options,
})
const seller = (name) => agent(name, { SELLER_WALLET, SOLANA_RPC_URL, AGENT_NAME: name, ...llmOpts })

await fetch(`${BASE}/api/v1/local/session`, {
  method: 'POST', headers: AUTH,
  body: JSON.stringify({
    agentGraphRequest: { agents: [
      agent('buyer-agent', buyerOpts),
      seller('seller-cheap'), seller('seller-premium'), seller('seller-lazy'),
    ] },
    namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
    execution: { mode: 'immediate' },
  }),
})
```

You name the graph — one buyer, three competing sellers — and CoralOS does the rest. Add a fourth seller to that array and it competes next round, no other changes.

### 3. CoralOS spawns the containers

For each agent in the graph, CoralOS boots its Docker container and injects a callback URL — `CORAL_CONNECTION_URL`. The agent doesn't know where CoralOS lives until this moment; CoralOS tells it.

### 4. The agent connects back

```ts
// inside every agent — startCoralAgent, from @pay/agent-runtime
const url = process.env.CORAL_CONNECTION_URL   // injected at step 3
await agent.connect()                          // opens MCP, discovers the verbs
await run(ctx)                                 // your loop takes over
```

Now it's in the room. It `waitForMention`s, `reply`s — and the market runs.

```
coral.toml          POST /session              spawn containers        connect back
 (registry)   ──▶   (name the graph)    ──▶    (+ inject URL)    ──▶   (verbs live) ──▶ bidding
```

> **The one idea:** you declare *which* agents; CoralOS handles launching them and wiring them together. You never start a container or pass an address by hand — and the difference between "a pair" and "a market" is just how many you list in the graph.


---

