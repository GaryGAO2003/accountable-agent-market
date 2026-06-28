<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/what-to-build-and-why/api-providers -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/what-to-build-and-why/api-providers.md).

# API Providers

| Provider                                                                   | Data network     | Env key                 | Status                   | What it is → what you can build                                                                                           |
| -------------------------------------------------------------------------- | ---------------- | ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [CoinGecko](https://www.coingecko.com/en/api)                              | off-chain        | —                       | ✅ `coingecko`            | Token price in USD → **price ticker**, portfolio valuation                                                                |
| [Jupiter](https://dev.jup.ag/)                                             | Mainnet          | `JUPITER_API_KEY` (opt) | ✅ `jupiter`              | Best swap route + Price API + token list → **SOL→token quote**, best-execution bot (the kit's default — copy this)        |
| [NewsAPI](https://newsapi.org/)                                            | off-chain        | `NEWS_API_KEY`          | ✅ `news`                 | Top crypto headlines → **market news digest** agent                                                                       |
| [Anthropic Claude](https://docs.anthropic.com/)                            | off-chain        | `ANTHROPIC_API_KEY`     | ✅ `inference` / `claude` | A Claude completion (also the agents' bidding brain) → **resell inference**, AI analysis-as-a-service                     |
| [TxLine / TxODDS](https://txline-docs.txodds.com/documentation/quickstart) | API (verifiable) | `TXLINE_API_KEY`        | ✅ `txline`               | Odds/scores/fixtures with Merkle roots on-chain → **live odds feed**, **match-resolution oracle** (free World Cup tier)   |
| [Public RPC](https://solana.com/docs/rpc)                                  | Devnet           | —                       | ◻ build-for              | Baseline JSON-RPC (balances, holdings, tx, accounts) → **wallet portfolio**, **tx explainer**. Start here — no key.       |
| [Helius](https://docs.helius.dev/)                                         | Devnet           | `HELIUS_API_KEY`        | ◻ build-for              | Enhanced RPC + DAS (tokens/NFTs, compressed) + parsed txns + webhooks → **"explain this transaction"**, **NFT portfolio** |
| [Pyth Network](https://docs.pyth.network/)                                 | Devnet           | —                       | ◻ build-for              | Pull-oracle price feeds with proof (Hermes) → **verifiable price**, an **oracle** for a market                            |


---

