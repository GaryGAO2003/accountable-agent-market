<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/solana-the-blockchain-for-the-agent-econonmy/keys-and-funding -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/solana-the-blockchain-for-the-agent-econonmy/keys-and-funding.md).

# Keys And Funding

### Wallets & Funding

You bring your own devnet keys — none ship in the repo. Two get generated, one you already have (Phantom).

#### Funding is web-only

All devnet SOL comes from the **faucet website** — sign in with GitHub:

> [**https://faucet.solana.com**](https://faucet.solana.com/)

CLI and RPC airdrops are rate-gated and will fail. The website is the only reliable way. Fund **every** wallet below.

#### Generate the keys

**The easy way — one command does both wallets and writes `.env`:**

```sh
node scripts/setup.js
```

This generates a seller wallet and a buyer wallet, drops them into `.env`, and prints both addresses to fund (also saved to `WALLETS.txt`). Re-running it is safe — it re-reads existing keys instead of overwriting.

#### Where each key goes

The seller only **receives**, so it needs a public address. The buyer **signs**, so it needs the full secret key.

```sh
# .env

# Seller — the wallet that RECEIVES payments. Public key only.
WALLET=<seller public key>

# Buyer — signs payments. Full secret key, base58-encoded.
BUYER_KEYPAIR_B58=<buyer secret key, base58>
```

| Agent                | Key it needs            | `.env` variable      | Fund it?                                     |
| -------------------- | ----------------------- | -------------------- | -------------------------------------------- |
| **Seller**           | public address          | `WALLET=`            | ✅ at faucet.solana.com                       |
| **Buyer**            | secret key (base58)     | `BUYER_KEYPAIR_B58=` | ✅ at faucet.solana.com                       |
| **Human (Checkout)** | your own Phantom wallet | — (signs in browser) | ✅ set Phantom to **Devnet**, fund separately |

> ⚠️ `BUYER_KEYPAIR_B58` is a **private key** — `.env` is gitignored for this reason. Never commit it, and never put a funded **mainnet** key in `.env` (`setRpc` rejects mainnet unless `ALLOW_MAINNET=1`).


---

