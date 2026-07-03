# Proposal v3 (Hybrid) — A "Prevent + Optimistic-Verify" Accountability Loop on Coral

> **UK AI Agent Hackathon EP5 × Conduct** · DoraHacks #2272 · Coral / CoralOS & STUK bounty (5,000 USDT)
> Single-track focus on **Coral** (Kaspa / Fetch dropped). Chain: **Solana + CoralOS**. Deadline: **2026-07-04 22:59**.
> Version note: v3 = V1's accountability *vision* re-founded on V2's *optimistic + objective-re-execution mechanism*, settlement-first, delivered as a gradient.

## 摘要 (中文)

Coral 提供了「AI agent 互相买卖服务、用 Solana 自动结算」的开放市场,但故意留空了最难的一层——**卖家可以撒谎/偷工/摆烂,没人执法**。我们补这一层。不走大而全的 V1,也不一步跳到极简 V2,而是 **hybrid**:用一条被实战验证的**乐观验证-then-pay 机制**当脊柱,把 V1 的「事前预防/信誉」作为低成本层叠上去,形成 **预防→检测→结算→信誉** 四段流水线,全部在 Solana + CoralOS,demo 以「成交→agent 决定付钱→作弊者当场被 slash」为主线。

## 1. The problem (validated by the market)

Agentic commerce is exploding (x402: **150M+ txns / $50M** in 9 months; **$3–5T** projected by 2030), but the **payment rails are already commoditized** (x402 / Google AP2 / Virtuals ACP / Olas). The unsolved layer is **trust**:

- Plain escrow only knows binary "delivered / not delivered" — it can't judge **quality**.
- A2A delegates security to implementers → impersonation, replay, recursive DoS.
- The "Logic Monopoly" (agents that plan + execute + evaluate themselves) is quantified: **84% attack success, 31% emergent deception** ([AE4E, arXiv 2603.25100](https://arxiv.org/abs/2603.25100)).

This is exactly the layer Coral's mission (zero-trust, govern, observe) leaves empty — and what we build.

## 2. Design principle: V1 vision + V2 mechanism + settlement-first

- **V1 was wrong in mechanism (verify-every + subjective slash) and sequencing (plumbing-first), not in vision.**
- Real cases pin the right mechanism: UMA/Kleros use **optimistic challenge + bond**; Chainlink slashes only on **objective deviation**; web2 (Fiverr/Upwork) use **auto-release after N days + human dispute** — **nobody verifies subjective quality per delivery.**
- Our honest delta vs [TessPay (Verify-then-Pay, arXiv 2602.00213)](https://arxiv.org/abs/2602.00213): use **re-execution as the adjudication predicate** — **no TEE / TLSNotary** — an order of magnitude lighter, buildable in 6 days.

## 3. Architecture — a four-stage accountability pipeline

```
① PREVENT ───────→ ② DETECT ───────→ ③ SETTLE ───────→ ④ REPUTATION
 Egress PEP         optimistic          escrow            Solana reputation PDA
 (V1, pre-flight)   challenge +         release / slash   + ERC-8004 naming
 (extend guard.ts)  objective re-exec   ↑Coral required↑  bond scales w/ reputation
                    (V2, verify-on-dispute)               (stretch: multi-hop attribution)
            └──────── all on Solana + CoralOS, single chain / single track ────────┘
```

- **Spine = ②③ (V2)**: seller delivers and posts a bond → **optimistic auto-release** (settles via Solana Pay if unchallenged in the window) → buyer/challenger can dispute by posting a bond → **Arbiter agent re-executes objectively (re-quote / recompute) → loser's bond is slashed and redistributed** (UMA economics).
- **① Prevent (V1)**: every outbound action passes a unified **Egress PEP** (allowlist · budget · velocity · replay-nonce · schema · integrity hash + audit log). V2 only covers after-the-fact; this adds before-the-fact → **prevent + detect double loop**, more complete than TessPay/UMA alone.
- **④ Reputation (V1, light)**: challenge outcomes write to a **Solana reputation PDA**; bond size scales with reputation (graduated trust). **ERC-8004** Identity/Reputation/Validation names the spine (framing only, ~zero extra eng).
- **Stretch**: counterfactual failure attribution for multi-hop deals (one scripted case, deck appendix — not in the core demo).

## 4. Why the hybrid beats both V1 and V2

| | V1 (full stack) | V2 (minimal) | **v3 Hybrid** |
|---|---|---|---|
| Verification | verify-every (costly/brittle) | optimistic | **optimistic** (from V2) |
| Adjudication | subjective grading | objective re-exec | **objective re-exec** (from V2) |
| Prevention | yes (Egress) | none | **yes (from V1) → double loop** |
| Reputation/standards | Kaspa + ERC-8004 (heavy) | ~none | **Solana PDA + ERC-8004 naming (light)** |
| Novelty collision | high (TessPay) | low | **low** (re-execution delta) |
| Scope / 6 days | overloaded | thin | **gradient ladder, just right** |
| Chains | three | one | **one (Solana)** |

## 5. Simplification from single-chain focus (Kaspa/Fetch dropped)
- Three chains → **Solana + CoralOS**: clean demo, no cross-chain bridge, no Kaspa TN12 risk.
- Reputation: Kaspa KRC-20 → **Solana PDA** — simpler, and hits Coral's "on-chain reputation layer" bonus.
- All effort concentrated on one loop → max out the Coral track.

## 6. Hero service (candidates — **not locked**)

**Selection rule**: the hero service's quality must be **objectively verifiable by re-execution**, else the slash collapses (rules out subjective services like Claude inference). Three candidates, one per verification paradigm:

| Candidate | Verification paradigm | Advantage | Cost |
|---|---|---|---|
| Jupiter verified best-execution | re-do & diff | crispest slash, lowest eng | kit default → weak differentiation |
| Helius wallet risk score | recompute formula | highest differentiation, thematic fit | needs a deterministic rubric first |
| TxODDS resolution oracle | proof-check | cryptographic verification, organizer bonus | medium eng, possible collision |

> Left open. The best fit for the "objective re-execution" spine is **Jupiter re-quote**, but you decide. A "hero + one secondary service" combo is fine.

## 7. Gradient build ladder (each rung is a shippable Coral submission)

| Rung | Content | Note |
|---|---|---|
| **L0** | Coral market runs + one real devnet settlement (Explorer link) | Coral minimum |
| **L1 (spine)** | bond + escrow + **optimistic challenge + objective re-exec + slash** | V2 core — **strong 5k contender on its own** |
| **L2 (+prevent)** | **Egress PEP** + audit log + reason-code taxonomy | V1 prevention, prevent+detect double loop |
| **L3 (+reputation)** | challenge outcomes → **Solana reputation PDA** → bond scales; ERC-8004 naming | V1 reputation/framing |
| **L4 (stretch)** | multi-hop counterfactual attribution (one scripted case) | V1 research, deck appendix |

**Stop-loss**: L0–L1 = complete prize core; L2/L3 = cheap, high-credibility add-ons; L4 only if time allows.

## 8. Coral judging map

> Note: Coral's formal rubric is still "dropping soon." The below follows the track/submission guidance as of 6/28 — re-confirm weights in Discord (`discord.gg/tRnC3YjMV`).

- [ ] ≥1 real devnet tx + Explorer `?cluster=devnet` link (① does it settle?)
- [ ] CoralOS (MCP) coordination in a **session thread**, not a side-channel — **Verifier/challenge messages also go through the thread**
- [ ] Solana Pay: recipient + amount + **unique reference**
- [ ] Differentiated service (②) / agentic depth: buyer, sellers, challenger, Arbiter all **decide and act** (③)
- [ ] Bonus (⑤): smart contract (bond/escrow/slash) + multi-agent graph + on-chain reputation
- [ ] Open-source repo + README + 3–6 slide deck + ≤3-min video showing **live settlement**

## 9. Demo script ("the proof slide wins")
1. **Normal round** — buyer posts a need → sellers bid → winner delivers + posts bond → unchallenged in the window → **Solana Pay auto-settles** (Explorer link).
2. **Plant a cheater** — lowest bid, deviating/garbage delivery.
3. **Challenge + objective re-execution** — challenger posts bond → Arbiter **re-executes and diffs** → deviation confirmed → **loser's bond slashed on-chain** (Explorer link); reputation PDA drops.
4. **(optional) Egress block** — show an obviously out-of-policy action blocked pre-flight + audit log.
5. **(stretch) Multi-hop** — a brokered deal fails → counterfactual attribution names the true culprit.

Every beat shows an on-chain transaction.

## 10. Pitch deck outline (5 slides)
1. **Customer & problem** — open agent markets have no accountability (cite 84%/31%).
2. **What it sells** — the hero `deliverService` in one line.
3. **Why it's trustworthy** — prevent (Egress) + optimistic verify (challenge + re-exec) + slash + reputation.
4. **The economy** — buyer/seller/challenger/Arbiter agent graph (single-chain Solana).
5. **Proof** — live settlement + slash, Explorer links. *(This slide wins.)*

## 11. Surviving novelty (narrow but true)

> *Optimistic-oracle dispute resolution (UMA/Kleros) brought to A2A **service-quality** settlement, using **re-execution as an automatable adjudication predicate** (no TEE/TLSNotary), combined with **pre-flight Egress prevention** for a prevent+detect double loop — native to Solana/CoralOS.*

Real marketplaces (Upwork/Fiverr) resolve disputes with **humans**; crypto oracles use **optimistic bonds**; we bring the latter to agent *service* markets with **automatable adjudication + pre-flight prevention**. Narrow, true, not yet productized. ERC-8004 / counterfactual attribution stay as background / future work — no overclaim.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Coral rubric not finalized | Confirm weights in Discord; follow track guidance and label it |
| Anchor/Rust (bond/escrow/slash) is the hard part | Use `solana-dev` skill to scaffold; fallback = deposit-to-program-address + transfer-based slash, no custom instruction required |
| Scope overload | L0–L4 ladder + stop-loss: L0–L1 already stands |
| Collision with TessPay / commoditized rails | Narrow to re-execution + prevent+detect as the honest delta |
| Slash not credible | Only use an **objectively re-executable** hero service |

## 13. References
- [TessPay — Verify-then-Pay (arXiv 2602.00213)](https://arxiv.org/abs/2602.00213) · [AE4E separation-of-power (arXiv 2603.25100)](https://arxiv.org/abs/2603.25100)
- [UMA optimistic oracle](https://www.polysyncer.net/blog/polymarket-uma-oracle-explained/) · [Kleros vs UMA](https://blog.kleros.io/kleros-and-uma-a-comparison-of-schelling-point-based-blockchain-oracles/) · [EigenLayer 2026](https://blockeden.xyz/blog/2026/03/20/eigenlayer-18b-tvl-vertical-avs-specialization-restaking-evolution/)
- [Coinbase x402 + AP2](https://www.coinbase.com/developer-platform/discover/launches/google_x402) · [Virtuals ACP](https://www.dextools.io/tutorials/what-is-virtuals-protocol-ai-agents-base-guide-2026) · [ERC-8004 EIP](https://eips.ethereum.org/EIPS/eip-8004)
- Coral starter kit [github.com/trilltino/solana_coralOS](https://github.com/trilltino/solana_coralOS) · local knowledge base `coral-knowledge/`
</content>
