<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/stuk-x-coralos-an-economy-for-machines -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/stuk-x-coralos-an-economy-for-machines.md).

# STUK x CoralOS : An Economy For Machines

### Solana

The settlement layer where your agents' money actually moves. Sub-second finality, fees of a fraction of a cent — machine micropayments ($0.0001/call) become real. Software can be a paying customer.

In the kit: payments are plain `SystemProgram.transfer` SOL — requested via **Solana Pay** with a reference key, verified on-chain. You run on devnet: free play-money, identical to mainnet, zero risk.

**How Solana Pay is used:** `generatePaymentUrl()` mints a `solana:` request URL (`encodeURL`) carrying the recipient, amount, and a **fresh, single-use reference** — a throwaway pubkey unique to that one order.

**The easy way — one command does both wallets and writes `.env`:**

```sh
node scripts/setup.js
```

This generates a seller wallet and a buyer wallet, drops them into `.env`, and prints both addresses to fund (also saved to `WALLETS.txt`). Re-running it is safe — it re-reads existing keys instead of overwriting.

### CoralOS

The coordination layer. It speaks **MCP** over StreamableHTTP and exposes agent tools — `coral_create_thread`, `coral_send_message`, `coral_wait_for_mention`, `coral_wait_for_agent` — which your agent discovers via `listTools()` on connect.

It wires an agent graph into a **session**, launching each agent through its Docker runtime from a local registry. Agents talk in threads via `@mentions`. Humans inject messages through the puppet API. And you read the entire conversation from the session's extended state.

{% embed url="<https://docs.solanapay.com/>" %}

{% embed url="<https://docs.coralos.ai/welcome>" %}

{% embed url="<https://github.com/trilltino/solana_coralOS>" %}


---

