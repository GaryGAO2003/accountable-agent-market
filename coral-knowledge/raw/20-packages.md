<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/packages -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/packages.md).

# Packages

`packages/` holds the kit's one shared library — **`agent-runtime`** (`@pay/agent-runtime`). Every TypeScript agent depends on it via a local `file:` link. It owns the agent loop, lifecycle, messaging, state, and the CoralOS connection, so you only ever write *behavior*.

```ts
import { startCoralAgent, BaseStrategy, AgentManager } from '@pay/agent-runtime'
```

#### What it gives you

| Export                      | What it is                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `startCoralAgent`           | the entrypoint — connects an agent to CoralOS, hands you a `ctx` (`waitForMention`, `reply`, `send`, `createThread`) |
| `CoralMcpAgent`             | the MCP client underneath it (StreamableHTTP transport, tool discovery)                                              |
| `BaseStrategy` / `Strategy` | the behavior interface: `run(state, signal)` + `handleMessage(text, state)`                                          |
| `AgentManager`              | runs many agents in one process; owns the shared `bus` + `state`                                                     |
| `MessageBus`                | broadcast / direct messaging between agents                                                                          |
| `SharedState`               | a versioned key-value blackboard all agents read/write                                                               |
| `WorkflowEngine`            | a DAG of steps for multi-step jobs                                                                                   |
| `strategies/*`              | ready templates: `Idle`, `RpcPoll`, `Weather`, `Transfer`, `Payment`, `HeliusMonitor`                                |

#### The two ways you use it

**1. A CoralOS agent** (what `coral-agents/` does) — you write the loop; the runtime handles spawning, connecting, and routing:

```ts
await startCoralAgent({ agentName: 'seller-agent' }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()      // a CoralOS message
    if (m) await ctx.reply(m, 'PAYMENT_REQUIRED …')
  }
})
```

**2. A reusable Strategy** — for the `AgentManager`/HTTP side, or to share logic:

```ts
class RiskStrategy extends BaseStrategy {
  readonly name = 'risk'
  async run(state, signal) { while (!signal.aborted) { /* monitor */ } }   // respect the AbortSignal
  async handleMessage(text) { return assess(text) }
}
```

#### The rule

You **build on it, you don't edit it.** New data to sell → `deliverService`. New autonomous behavior → `startCoralAgent`. Reusable logic → `BaseStrategy`. The runtime's job is to make all three "just work" against CoralOS and Solana — full reference in `packages/agent-runtime/README.md`


---

