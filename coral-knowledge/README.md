# Coral / CoralOS Knowledge Base

> Distilled from the **Solana × CoralOS — Imperial AI Agents Hackathon** GitBook.
> Source: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos
> Captured: 2026-06-28. Docs were "last updated 1 day ago" at capture time.

## Purpose of this folder

This is a self-contained study pack about **CoralOS** (the agent-coordination layer)
and the **Solana × CoralOS agent-economy kit** (`sol_coralOS`). It is written so that
**another agent can read it cold and become productive** without re-fetching the site.

## The one-sentence model

> **CoralOS moves _messages_. Solana moves _money_.**
> Agents coordinate in a shared chat (CoralOS / MCP threads); trustless settlement
> happens on-chain via a Solana **escrow** contract. The two systems never touch.

## How to read this (recommended order)

| # | File | What it covers |
|---|------|----------------|
| 1 | [`01-overview.md`](01-overview.md) | The big picture: what the kit is, the agent economy thesis, the 8 layers |
| 2 | [`02-coralos.md`](02-coralos.md) | **CoralOS deep dive** — what it is/isn't, the 4 verbs, lifecycle, the agent's view, the boundary, how to expand it |
| 3 | [`03-solana-escrow.md`](03-solana-escrow.md) | Solana settlement: keys & funding, Solana Pay, the escrow contract (Rust), the arbiter upgrade |
| 4 | [`04-codebase-kit.md`](04-codebase-kit.md) | `sol_coralOS` repo: how to run it, the agents, `@pay/agent-runtime` package, the frontend (vanilla + React) |
| 5 | [`05-what-to-build.md`](05-what-to-build.md) | The 7 expansion surfaces, API/infra providers, build ideas |
| 6 | [`06-submission.md`](06-submission.md) | Hackathon submission requirements, judging, pitch deck |
| 7 | [`07-glossary-cheatsheet.md`](07-glossary-cheatsheet.md) | Quick glossary, command cheatsheet, the message protocol |

`raw/` holds the **verbatim** fetched markdown of every source page, for citation or
re-reading. The numbered files above are the distilled / synthesized version.

## Most important takeaways (TL;DR)

1. **CoralOS = a bot launcher + a group-chat server for agents.** It boots each agent as
   a Docker container per session and routes their `@mention` messages in threads. It is
   wallet-free and holds no funds.
2. **Agents = a `while` loop over 4 verbs**: `coral_create_thread`, `coral_send_message`,
   `coral_wait_for_mention`, `coral_wait_for_agent`. You write behavior; the runtime
   (`@pay/agent-runtime`) handles transport, MCP discovery, reconnection.
3. **Money is agent-side, on Solana**: buyer `deposit`s into a per-order escrow PDA,
   seller checks `isFunded` on-chain before delivering, buyer `release`s on delivery or
   `refund`s after a deadline.
4. **The headline build** is an **arbiter agent** + an `arbitrate` instruction → trustless
   three-party settlement (no one needs to be trusted).
5. **The main fork point** is `deliverService()` — return a string, it gets monetized.
