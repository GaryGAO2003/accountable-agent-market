<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/agents -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/agents.md).

# Agents

The agents live in `coral-agents/` — each is a small TypeScript program built on `@pay/agent-runtime`. CoralOS launches them per session; they talk over threads.

#### The agents in the kit

| Agent            | Role                                                                                                                             | Fork point                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **seller-agent** | The fulfillment agent: `request → PAYMENT_REQUIRED → paid → DELIVERED`. Verifies payment on-chain, then delivers.                | `src/service.ts → deliverService()` |
| **buyer-agent**  | The autonomous buyer: requests a service, decides to pay (an LLM with a code-enforced budget), pays on-chain, receives the data. | `src/{goal.ts, llm_buyer.ts}`       |
| **echo-agent**   | The minimal agent — echoes any mention. A connectivity check and the **template to copy** for a new agent.                       | `src/index.ts`                      |

#### The shape of every agent

`echo-agent` is the whole pattern in five lines — connect, wait for a message, reply:

```ts
// coral-agents/echo-agent/src/index.ts
import { startCoralAgent } from '@pay/agent-runtime'
await startCoralAgent({ agentName: 'echo-agent' }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()
    if (m) await ctx.reply(m, `echo: ${m.text}`)
  }
})
```

The seller and buyer are this same loop with real logic inside. You only write `run`; CoralOS handles spawning, connecting, and routing.

#### Adding a new agent

Say you want a **broker**. Four files in `coral-agents/broker/`:

**1. `src/index.ts`** — the behavior:

```ts
import { startCoralAgent } from '@pay/agent-runtime'
await startCoralAgent({ agentName: 'broker' }, async (ctx) => {
  while (true) {
    const ask = await ctx.waitForMention()
    if (ask) await ctx.reply(ask, await routeToCheapestSeller(ctx, ask.text))
  }
})
```

**2. `coral-agent.toml`** — the manifest CoralOS reads (name + options + image):

```toml
edition = 4
[agent]
name = "broker"
version = "0.1.0"
description = "Routes a request to the cheapest seller."
[agent.license]
type = "spdx"
expression = "MIT"
[options]
SOLANA_RPC_URL = { type = "string", default = "" }
[runtimes.docker]
image = "broker:0.1.0"
```

**3. `package.json`** — depend on the runtime:

```json
{ "name": "broker", "type": "module",
  "dependencies": { "@pay/agent-runtime": "file:../../packages/agent-runtime" } }
```

**4. `Dockerfile`** — same as the other agents (build from repo root so it bundles `packages/`).

**Then register + run:**

* `config/coral.toml` already scans `localAgents = ["/agents/*"]` → your agent is **auto-discovered**, no edit needed.
* Build the image: `docker build -f coral-agents/broker/Dockerfile -t broker:0.1.0 .`
* **Name it in a session** and CoralOS launches it:

```ts
agents: [buyer-agent, broker, seller-agent]   // coral spawns all three into one session
```

> That's the whole model: **write a `startCoralAgent` loop, give it a manifest + image, name it in a session.** The kit handles discovery, launching, and the MCP wire — you just decide what the agent *does*.


---

