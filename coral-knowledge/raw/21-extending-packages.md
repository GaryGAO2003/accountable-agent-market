<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/packages/extending-packages -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/packages/extending-packages.md).

# Extending Packages

#### Extend it for your use case

Three paths, smallest first. Say your idea is **"an agent that sells a wallet's risk score."** The key thing: **the kit wraps CoralOS for you** — you talk to a small `ctx` object, not coral-server's API.

**Path A — just a new service** (90% of projects). Add a branch to the seller. **Zero CoralOS contact** — the seller's existing loop already does all the messaging; you only write the logic that returns a string.

```ts
// coral-agents/seller-agent/src/service.ts → deliverService(request)
case 'risk-score': return riskScore(request)

async function riskScore(addr: string): Promise<string> {
  const conn = new Connection('https://api.devnet.solana.com')
  const txs = await conn.getSignaturesForAddress(new PublicKey(addr), { limit: 50 })
  return JSON.stringify({ wallet: addr, riskScore: Math.min(100, txs.length * 2) })
}
```

Set `SERVICE=risk-score`. The request/pay/deliver conversation is handled — you never see CoralOS.

**Path B — a whole new agent** (when you need new *behavior*, e.g. a broker). Here you *do* touch CoralOS — but only through `ctx`. `ctx.waitForMention()` and `ctx.reply()` **are** CoralOS messages (under the hood, MCP tool calls), wrapped so you don't write any networking:

```ts
// coral-agents/risk-agent/src/index.ts
import { startCoralAgent } from '@pay/agent-runtime'
await startCoralAgent({ agentName: 'risk-agent' }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()        // ← receive a CoralOS message
    if (m) await ctx.reply(m, await assess(m.text))  // ← send one back
  }
})
```

CoralOS auto-discovers the agent (`coral.toml` scans `/agents/*`) and launches it when a session names it. **You write the `while` loop; CoralOS handles spawning, connecting, and routing.**

**Path C — a reusable Strategy** (the `AgentManager`/HTTP side). **No CoralOS at all** — this runs in-process:

```ts
import { BaseStrategy } from '@pay/agent-runtime'
export class RiskStrategy extends BaseStrategy {
  readonly name = 'risk'
  async run(state, signal) { while (!signal.aborted) { /* monitor */ } }
  async handleMessage(text, state) { return assess(text) }
}
```


---

