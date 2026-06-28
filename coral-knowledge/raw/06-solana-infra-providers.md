<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/what-to-build-and-why/solana-infrastructure-providers -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/what-to-build-and-why/solana-infrastructure-providers.md).

# Solana Infrastructure Providers

**Helius** — an enhanced Solana RPC provider. Faster and more reliable than the public devnet endpoint, with real-time WebSocket account monitoring (`onAccountChange`).&#x20;

Optional in the kit: the payment loop runs on the public RPC, but a free Helius key helps under load and powers the runtime's `HeliusMonitorStrategy` for "watch this account" services. → Sign up (free tier): [helius.dev](https://helius.dev/)

<figure><img src="/files/oM1oU6aDNmYj1eDXk79Y" alt=""><figcaption></figcaption></figure>

<figure><img src="/files/OrlPfOYc4VMlCqRpZyiy" alt=""><figcaption></figcaption></figure>

<div align="left"><figure><img src="/files/YxafpsLnEzKkgZazmwn4" alt=""><figcaption></figcaption></figure></div>

**Jupiter** — Solana's swap aggregator and price API.

&#x20;In the demo, the seller's default service calls Jupiter's quote endpoint to return a live SOL→USDC price. It's read-only (a quote, not a trade), free without a key; a key just raises rate limits. → Free, no key needed; keys for higher limits: [jup.ag/developers](https://dev.jup.ag/) · docs at [station.jup.ag](https://station.jup.ag/)

**Can Jupiter power different agents?** Yes — it's just a data source behind `deliverService`, so different agents can use it differently:&#x20;

a **price-quote** agent,&#x20;

a **best-route** agent (Jupiter returns the optimal swap path),&#x20;

an **arbitrage** agent comparing Jupiter vs CoinGecko,&#x20;

or a **slippage/impact** monitor.&#x20;

Jupiter also covers tokens, prices, and limit orders beyond the basic quote.


---

