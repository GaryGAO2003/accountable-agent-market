# Proposal — The Accountability Layer for Open Agent Economies

> **UK AI Agent Hackathon EP5 × Conduct** · DoraHacks #2272
> Targeting **Coral (5,000 USDT) + Fetch.ai (1,000 USDT) + Kaspa (1,000 USDC)** on one BUIDL.
> Submission deadline: **2026-07-04 22:59**.

## 摘要(中文)

Coral 给了一个「AI agent 互相买卖服务、用 Solana 自动结算」的开放市场,但它有个大洞:**卖家可以骗钱、交垃圾,没人执法。** 我们补的就是这个洞——一套四层**问责栈**(事前拦截 → 出错兜底 → 标准化信任 → 打分罚款+追责),让乱来的 agent 会被当场抓住、罚没押金、烧掉信誉。三条链各司其职:**Solana 管钱与罚款、Kaspa 管可携带的信誉身份、Fetch 管自然语言发现**。新颖性来自对齐真实标准 **ERC-8004**(并首次搬到非 EVM 的 Solana+Kaspa)+ 补上它留空的「执法」与「失败归因」。

---

## 1. The problem

Open agent-to-agent (A2A) markets let any agent advertise a service and get paid. The hard part isn't matching buyers and sellers — it's **trusting strangers**:

- Sellers can **lie, under-deliver, or fail**. Plain escrow only knows binary "delivered / not delivered" — it can't judge *quality*.
- A2A's own security is **delegated to implementers** → fake agent advertisement, card tampering, replay, recursive-delegation DoS, no semantic validation ([arXiv 2602.11327](https://arxiv.org/html/2602.11327v2)).
- When a **multi-hop deal** (broker → seller → oracle) fails, no one can say **whose fault it was**.

This is a root cause of the 2026 "multi-agent credibility backlash": multi-agent systems often fail to beat a single agent **because there is no accountability**.

Coral's own thesis is *"zero-trust coordination infrastructure … compose, **govern, observe**, and scale agent systems in production."* The starter kit ships the market but deliberately leaves the trust/governance layer empty. **We build that layer.**

## 2. The solution — a four-layer accountability stack

```
Outbound agent action (bid / deliver / pay / message)
        │
   ① EGRESS PEP ............ PREVENT: policy gate before any action commits
        │                    (allowlist · budget · velocity · replay-nonce · schema · integrity hash · audit log)
        ▼
   ② WEB2 FRAUD/ERROR OPS ... OPERATE: idempotency keys · retry+backoff · circuit breaker ·
        │                    dispute window (= chargeback) · anomaly/velocity checks ·
        │                    graduated trust limits · "decline reason-code" taxonomy
        ▼
   ③ ERC-8004 TRUST TRIAD ... STANDARDIZE: Identity / Reputation / Validation registries
        │                    implemented across Solana (PDA) + Kaspa (KRC-20) — first non-EVM impl
        ▼
   ④ ENFORCE + ATTRIBUTE .... ENFORCE: Verifier grades quality → reason-code →
                             Solana slash stake + Kaspa burn reputation +
                             counterfactual failure attribution for multi-hop deals
```

### ① Egress PEP (prevent)
A unified policy-enforcement point every agent's outbound action passes through *before* it commits. Coral already enforces budget/floor/allowed-recipients in code (`guard.ts`) — we generalize that into a first-class **egress gateway** with structured audit logging. Each check maps to a known A2A attack:

| Check | A2A attack it blocks |
|---|---|
| recipient allowlist (only seen in a real 402 challenge) | phishing payment / card tampering |
| replay nonce + unique `reference` | replay attack |
| velocity / rate limit | recursive-delegation DoS |
| schema + semantic validation | prompt injection / fake capability advertisement |
| tamper-evident audit log | feeds ③ Reputation & ④ Attribution |

### ② Web2 fraud/error operations (operate)
Port battle-tested internet patterns into the agent economy:
- **Errors**: HTTP semantics (Coral already uses 402) · **idempotency keys** (a retried payment never double-charges) · exponential backoff + jitter · **circuit breaker** (stop routing to a failing seller) · dead-letter → dispute.
- **Fraud**: **dispute window = chargeback** (escrow refund deadline + `arbitrate`) · anomaly/velocity detection (catches sybil & collusion) · **graduated trust limits** (new/low-reputation agents get low caps; trust unlocks volume — Stripe/PayPal-style onboarding).
- **Signature artifact — the "decline reason-code" taxonomy**: like card-network chargeback reason codes, define a code set for agent-economy failures (`NON_DELIVERY` · `QUALITY_FAIL` · `TIMEOUT` · `SCHEMA_INVALID` · `FRAUD` · `UPSTREAM_FAULT`). The Verifier emits a reason-code that drives attribution, reputation, and dispute resolution in one shared vocabulary.

### ③ ERC-8004 trust triad (standardize)
[ERC-8004 "Trustless Agents"](https://eips.ethereum.org/EIPS/eip-8004) extends Google's A2A with three on-chain registries. **We implement the triad on a non-EVM, multi-chain stack — a first.**

| ERC-8004 registry | Our implementation |
|---|---|
| **Identity Registry** | CoralOS agent + Solana PDA identity (optional Kaspa address binding) |
| **Reputation Registry** | **Kaspa KRC-20 "reputation passport"** — portable across markets |
| **Validation Registry** | **Verifier/Arbiter agent + Solana `arbitrate` instruction** (crypto-economic validation via stake) + optional Pyth/TxLine merkle proofs (cryptographic validation) |

This aligns us to a real 2025/26 standard **and** fills the two gaps ERC-8004 leaves abstract: **enforcement** and **failure attribution**.

### ④ Enforce + attribute (our research moat)
The Verifier scores delivery *quality* against the WANT spec (LLM-judge with rubric) → emits a **reason-code** → **slashes stake on Solana** + **burns reputation on Kaspa**. For multi-hop failures, **counterfactual failure attribution** (replay-and-attribute) pins blame on the true culprit before slashing — so honest intermediaries aren't punished.

## 3. Architecture — three orthogonal concerns, one per chain

| Concern | Chain | Role |
|---|---|---|
| **Money / enforcement** | **Solana** (Coral) | delivery escrow + arbiter + `arbitrate` + stake/slash |
| **Identity / reputation** | **Kaspa** | portable KRC-20 reputation passport (Kasplex Kiwi JS SDK, TN11) |
| **Discovery / interface** | **Fetch.ai** | uAgent + Chat Protocol on Agentverse, found via ASI:One |

**Solana = money at risk for *this* deal. Kaspa = identity that *outlives* any deal. Fetch = how you're *found*.** No overlap; each load-bearing.

## 4. Novelty statement (for pitch / abstract)

> *ERC-8004 defines the trust **registries** but leaves **enforcement** and **failure attribution** abstract, and is EVM-only. A2A defines **communication** but delegates **security** to implementers (impersonation, replay, recursive DoS). We close both gaps: a non-EVM, multi-chain (Solana + Kaspa) implementation of the ERC-8004 trust triad for a CoralOS/A2A market, fronted by an **egress policy-enforcement point** (prevention) and **web2-grade fraud/error handling** (resilience), with **counterfactual failure attribution** as the validation mechanism's brain. Prevention + standards + enforcement + attribution = the first end-to-end accountability stack for open agent economies.*

## 5. What we build vs. reuse

| Component | Build / Reuse |
|---|---|
| CoralOS market, escrow (`initialize/release/refund`), buyer/seller/broker, dashboard | **Reuse** (`solana_coralOS` starter kit) |
| Differentiated `deliverService()` | Build (small fork) |
| Egress PEP + audit log | Build (generalize `guard.ts`) |
| Reason-code taxonomy + dispute window + idempotency/circuit-breaker | Build (mostly app logic) |
| Verifier/Arbiter agent (new agent #4) | Build |
| Solana `arbitrate` + stake/slash + reputation PDA (#5) | Build (via `solana-dev` skill → Anchor + LiteSVM) |
| Kaspa KRC-20 reputation passport | Build (`@kasplex/kiwi-web`) |
| Fetch uAgent + Chat Protocol registration | Build (Python `uagents`) |
| Counterfactual attribution (3-hop) | Build (research overlay) |

## 6. Bounty requirements checklist

**Coral (required):**
- [ ] ≥1 real devnet transaction + Solana Explorer `?cluster=devnet` link
- [ ] CoralOS (MCP) coordination in a **session thread** (not a side-channel)
- [ ] Solana Pay: recipient + amount + **unique reference**
- [ ] Open-source repo + README (one-command run)
- [ ] Pitch deck (3–6 slides) + demo video (≤3 min) showing **live settlement**
- [ ] Bonus: smart-contract extension (arbiter/`arbitrate` + staking/slashing) ✅

**Fetch.ai:**
- [ ] Agent(s) registered on **Agentverse**, discoverable + usable via **ASI:One**
- [ ] Core use case demoable inside an ASI:One conversation (Chat Protocol)

**Kaspa:**
- [ ] Kaspa used as a **programmable coordination/commitment layer, not a payment rail** (KRC-20 reputation passport, minted/burned from verdicts)

## 7. 6-day plan (checkpoint-laddered — each rung ships)

1. **D1 — Coral floor**: clone kit, run on devnet, fork `deliverService()`, land **one settled tx + Explorer link**.
2. **D2–3 — Coral prize path**: Verifier agent + `arbitrate` + stake/slash + reputation PDA (via `solana-dev`). Demo: cheater under-delivers → slashed on-chain. *(Lock 5k.)*
3. **D3 — Egress PEP + reason-codes + dispute window**: generalize `guard.ts`, add audit log + reason-code taxonomy (low cost, high novelty).
4. **D3.5 — Fetch (+1k)**: uAgent + Chat Protocol + Agentverse; trigger market from ASI:One.
5. **D4 — Kaspa (+1k)**: KRC-20 reputation passport via Kiwi; verdict → mint/burn. *(Noon decision gate: if Kiwi fights back, fall back to minimal mint+transfer.)*
6. **D5 — Differentiation**: counterfactual attribution on a 3-hop deal + self-evolving seller overlay + dashboard (stakes / reputation / attribution graph).
7. **D6 — Package**: ≤3-min video (lead with live settlement), 5-slide deck, README, Explorer links; submit on DoraHacks (all 3 bounties) + email `xforce94@gmail.com` + post in sponsor Discords.

**Stop-loss:** rungs 1–4 alone = strong Coral + Fetch (~6k). Kaspa is the only real-risk add, and it's de-risked to mature KRC-20 tooling.

## 8. Demo script (Coral: "the proof slide wins")

1. **Normal round** — user finds the market via ASI:One → sellers bid → winner delivers → escrow releases (Explorer link).
2. **Plant a cheater** — lowest bid, garbage delivery.
3. **Egress + Verifier** — egress logs the action; Verifier grades it `QUALITY_FAIL` → **stake slashed on Solana + reputation burned on Kaspa** (both Explorer links).
4. **Multi-hop failure** — a brokered deal fails; **counterfactual attribution names the true culprit** (not the broker).
5. **Convergence curve** — with accountability on, the market converges to honest behavior.

Every beat shows an on-chain transaction.

## 9. Pitch deck outline (5 slides)

1. **The customer & problem** — open agent markets have no accountability.
2. **What it sells** — the `deliverService` + the accountability layer on top.
3. **Why they pay / why it's trustworthy** — egress prevents, web2-ops resolves, ERC-8004 standardizes, slashing+attribution enforces.
4. **The economy** — a graph of agents (buyer/seller/broker/verifier) across 3 chains.
5. **Proof** — live settlement + slash, Explorer links. *(This slide wins.)*

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Kaspa SilverScript covenants too raw (TN12, Rust, no WASM) | Use **KRC-20 via Kasplex Kiwi (JS, TN11)** as baseline; covenant only as stretch |
| Scope (3 chains in 6 days) | Checkpoint ladder + stop-loss: even if Kaspa slips, bank Coral+Fetch (~6k) |
| Coral judges want settlement, not just research | Rung 1 lands a live tx before any research layer; "proof slide" leads the demo |
| Counterfactual attribution too broad | Scope to one scripted 3-hop failure + replay, not a general engine |

## 11. References

- ERC-8004 Trustless Agents — [EIP](https://eips.ethereum.org/EIPS/eip-8004) · [dev guide](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/)
- A2A security threat modeling — [arXiv 2602.11327](https://arxiv.org/html/2602.11327v2) · [improving A2A](https://arxiv.org/html/2505.12490v3)
- AI agent egress / guardrails — [Galileo guardrails survey](https://galileo.ai/blog/best-ai-agent-guardrails-solutions)
- Coral starter kit — [github.com/trilltino/solana_coralOS](https://github.com/trilltino/solana_coralOS)
- Kaspa KRC-20 — [Kasplex docs](https://docs-kasplex.gitbook.io/krc20) · [Kiwi web SDK](https://www.npmjs.com/package/@kasplex/kiwi-web)
- Fetch.ai — [ASI:One uAgent example](https://uagents.fetch.ai/docs/examples/asi-1) · [Agentverse launch guide](https://docs.agentverse.ai/documentation/launch-agents/launch-asi-one-compatible-u-agent)
- Local knowledge base — `coral-knowledge/` (CoralOS, Solana escrow, codebase kit, submission rules)
</content>
</invoke>
