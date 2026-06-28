<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos.md).

# sol\_coralos

A working agent economy on Solana: a **seller agent** sells a service for SOL, a **buyer** (another agent or a human) pays for it on-chain. This page gets it running on your machine in \~20 minutes and explains what "running" actually means.

#### Prereqs

* **Docker Desktop** (running) · **Node 20+** · a **Phantom** wallet (for the human checkout)
* `just` ([install](https://github.com/casey/just)) — optional but it's the one-shot
*

````
```sh
````

````
# Windows (PowerShell)
winget install Casey.Just
#   or:  scoop install just

# macOS
brew install just

# Linux  (or anywhere with Rust)
cargo install just
```
````

#### Fork + run (fastest path)

```sh
git clone https://github.com/<you>/sol_coralOS    # your fork
cd sol_coralOS
just dev                                           # ← the one command
```

> [**faucet.solana.com**](https://faucet.solana.com/) — sign in with **GitHub** (the web faucet is the only way; CLI/RPC airdrops are gated).

Copy **both** addresses into the faucet and request devnet SOL:

```
sol_coralOS — devnet wallets

  Seller wallet  copy x
  Buyer  wallet  copy x
```

`just dev` (or `node scripts/setup.js`) generates two devnet wallets and saves their addresses to **`WALLETS.txt`** in the repo root --   [**faucet.solana.com**](https://faucet.solana.com/) — sign in with **GitHub** and request an airdrop to both addresses.

Open [**http://localhost:3010**](http://localhost:3010/).

#### No `just`? Same thing by hand

```sh
cd scripts && npm install && cd ..
node scripts/setup.js          # makes wallets → .env, prints 2 addresses
# fund both at faucet.solana.com (GitHub sign-in)
bash build-agents.sh           # build seller / buyer / user-proxy images
docker compose up -d coral bridge
# open http://localhost:3010
```

#### What "starting it up" actually means

Here's the part that trips people up: **`docker compose up` does not start the agents.** It starts two things:

* **coral-server** (`:5555`) — the coordination layer, sitting idle, waiting.
* **the bridge** (`:3010`) — the Express server that serves the demo UI and talks to coral.

At this point **no buyer or seller is running.** The agents aren't long-lived services — they're spawned **on demand, per session.**

#### Where the agents come in

When you open `localhost:3010` and click **Run the agent↔agent demo** (the Autonomous tab):

```
you click Run
  → bridge asks coral: "make a session with [buyer-agent, seller-agent]"
  → coral LAUNCHES both as Docker containers
  → each agent connects back to coral over MCP
  → buyer opens a thread, sends "request…", seller replies "pay…", buyer pays on-chain, seller delivers
```

So the lifecycle is: **coral + bridge run continuously; the agents flicker into existence when a session names them, do their trading, and that's the demo you watch.** (The human **Checkout** tab is the same, with *you* as the buyer paying via Phantom.)

> In short: `just dev` boots the *infrastructure*; clicking **Run** (or `cd examples/agent-economy/autonomous && npm start`) is what brings the **agents** to life and starts the economy.


---

