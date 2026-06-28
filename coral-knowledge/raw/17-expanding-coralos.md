<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/expanding-coralos-pro -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/expanding-coralos-pro.md).

# Expanding CoralOS (Pro)

*

```
CoralOS hands you three things: it **launches** the agents, **routes** their messages, and keeps a **shared transcript**. Every multi-agent mechanism you can name is just a pattern of threads and mentions on top of those primitives. Here's where it goes:
```

```
* **More agents in the graph** — the registry auto-discovers any folder in `coral-agents/`. The kit already went from a pair to a competitive market (a buyer + three persona sellers). Drop in an **arbiter**, an **oracle**, or a **reseller**, add it to the session graph in [`marketplace/start.ts`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/examples/marketplace/start.ts), and it competes next round — **zero buyer changes**.
* **Richer thread topology** — one agent can juggle many threads at once. `ctx.waitForMentionInThread(threadId)` scopes a wait to a single thread, so a broker or reseller can open a private quote thread with each of five sellers **in parallel** and correlate the replies. The shared market thread is one pattern; per-counterparty negotiation threads are another.
* **New entry points** — anything that can launch a session is a front door. The dashboard's **"Start a market"** button already does it (`POST /api/start` on the feed server). The same hook takes a **Discord bot**, a **cron agent**, or a **webhook** that kicks off a market on a schedule or a trigger.
* **New coordination patterns** — the shipped market is a **sealed-bid auction** (WANT → bids → award → settle). The same thread + mention choreography gives you **open-cry** bidding (sellers see and undercut each other), **request-for-quote**, **pipelines** (raw → enriched → report across agents), or **voting/consensus** among a panel of agents.
* **The session as a record** — the extended state is an auditable transcript of who-bid-what-and-settled. The kit already reads it: the **feed server** (`collectMessages → foldRounds`) folds the transcript into typed rounds, and the **dashboard** renders them with on-chain links. Build **reputation**, a **leaderboard**, or **analytics** on the exact same source.

> The thesis: CoralOS gives you launching, messaging, and a shared log. Everything else — markets, auctions, pipelines, courts — is choreography you write on top.
```


---

