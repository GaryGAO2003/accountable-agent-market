# Critical Review of PROPOSAL v3 — 旁注 (not part of the main proposal)

> 这是对 `PROPOSAL.md` (v3 Hybrid) 的批判性评审与建议,**独立存放,不写入主提案**。
> 用途:决策参考 / devil's advocate。主提案要不要采纳由你决定。
> 基准:`coral-knowledge/` (Coral 赛道 + 提交规则) · 截止 2026-07-04 22:59 · 单链 Solana + CoralOS。

---

## 0. 一句话判断

v3 方向对(单赛道、settlement-first、梯度阶梯都正确),但它用 **「乐观验证 + 单一 Arbiter + 未锁 hero service」** 三件事给自己挖了坑。把这三件收敛成 **「verify-then-pay + 可复算谓词 + TxODDS」**,方案就既诚实又能打。

---

## 1. 最致命:机制选择与自身卖点自相矛盾

**问题**
- 选乐观验证(optimistic)的唯一理由是「verify-every 太贵/太脆」(§4 表格)。
- 但全篇护城河又是「再执行便宜、可自动化,比 TessPay 轻一个数量级」(§2、§6)。
- **这两条不能同时成立。** 乐观预言机(UMA)之所以乐观,前提是验证昂贵(靠人类投票);一旦验证便宜且可自动化,「挑战窗口 + 双边保证金 + 重分配」就是纯多余复杂度。
- 更要命:挑战者要决定是否挑战,**本来就得先自己再执行一遍**——成本没省,只是从 Arbiter 搬到挑战者,还多加一层博弈。
- demo 里你**每次都要人为制造争议**,观众永远看不到「乐观省下的那次验证」。乐观的好处在 demo 里不可演示。

**建议**
- **放弃乐观,改 verify-then-pay**:卖家交付即附 bond → Arbiter **每次都客观再执行 + diff** → 一致则 `release`、偏差则 `slash` 并赔付买家。更简单、更少 Rust、戏剧性一样,且自动消解「挑战窗口在短命会话里续命」的架构难题(见 §5)。
- 想保留乐观叙事 → 只放进 deck 的 "future work" 一句话(production-scale 省验证成本),**不进核心机制**。

---

## 2. 「zero-trust」是假的:Arbiter 是单一可信再执行者

**问题**
- UMA 的全部意义是用经济投票避免单一仲裁者;v3 保留单一 Arbiter,就**得不到去中心化收益**,却付出了乐观的复杂度——两头不讨好。
- 「谁输」由 Arbiter 再执行决定 → 整个信任模型塌缩到「相信 Arbiter」这一个点。硬讲 zero-trust 会被一句话戳破。

**建议**
- 叙事从「无需信任任何人」**降级为「verifiable adjudication」**:Arbiter 的再执行**任何第三方都能拿同样输入复现同样结果**(尤其配 TxODDS 链上证明)。这是真的,守得住。

---

## 3. 单点关键路径被显式推迟:hero service "not locked"(§6)

**问题**
- 再执行语义与服务**强耦合**,无法「先做通用 spine 后插服务」。这是关键路径,不能留作开放项。
- 三个候选各有一个洞:
  - **Jupiter re-quote** —— 交付和再执行之间**价格本来就会动**,无法区分「卖家撒谎」vs「行情移动」。救它要时间戳绑定 + 容差带 + 滑点核算,而**容差带正是 slash 误判的发源地**。镜头前罚错诚实卖家 = 比没 slash 更糟。
  - **Helius 风险分** —— 自己注明「需先有确定性 rubric」;rubric 一旦就是规格,卖家照跑即可,**服务失去可买价值**(伪命题)。
  - **TxODDS** —— proof-check 是三者中**唯一真正客观**的,标注的风险("collision")远小于 Jupiter 的「判不准」。

**建议**
- **D-1 锁定 TxODDS 解析预言机**(带 Merkle 根,0/1 判定,无容差争议;组织方 6/30 有 TxOdds 工作坊,加分)。
- 配套写一页**「判偏差」确定性谓词规格**(输入 / 期望输出 / 判等函数)。这页是 slash 可信度的命根。

---

## 4. 范围冗余:Egress PEP 与 ERC-8004 是装饰

**Egress PEP(L2)**
- 与验证脊柱**完全正交**,是通用中间件;demo 第 4 拍「挡掉违规动作」**根本不上链**,和「every beat shows an on-chain tx」自相矛盾。
- 建议:降为 README/deck **一段**说明 + 最小拦截器,**不进核心 demo 拍点、不占脊柱工时**。"reason-code taxonomy" 就是个 enum,别包装成创新。

**ERC-8004**
- "naming only, ~zero eng" 是最差状态:零收益,却招来「这真是 ERC-8004 吗」的审视。
- 建议:**直接删**。干净的 Solana reputation PDA 自己就站得住。

---

## 5. 架构盲点:挑战窗口 vs. CoralOS 短命会话

- kit 的 agent 是即生即灭的 request/deliver 循环(`04-codebase-kit.md`),**没有长驻 watcher**;杀掉 coral-server 市场就停(`02`)。
- 乐观机制需要「交付 → 保持窗口 N → 挑战 → 再执行 → slash」的跨时间编排,**谁在窗口期保持会话/线程存活?** 提案未提。
- **采纳 §1(改 verify-then-pay)→ 此问题自动消失**(额外红利)。若仍保留延时窗口,必须在 L1 设计时定下:Arbiter 做成会话内长驻 agent,或把窗口压成同一会话的同步一拍。

---

## 6. 硬性合规:消息必须走 CoralOS thread

- Coral 必需项:协调在 **session thread 内,非侧信道**。
- Arbiter 的再执行结果、slash 决定**必须发进 thread**,不能走私有 RPC/HTTP。
- 写进 L1 验收标准,别等 demo 才发现违规。

---

## 7. 真实性暴露面(终点线自爆风险)

**逐条核实,验不到就改措辞:**
- arXiv **2602.00213**(TessPay)/ **2603.25100**(AE4E)
- 统计:**84% attack / 31% deception**、x402 **150M txns / $50M / 2030 $3–5T**
- 经济机制别拿 dextools 教程 / polysyncer 博客当权威 → 换 UMA 官方文档 / 原论文,或降级为「directional estimate / 据公开报道」。
- 任一引用是幻觉号或错引,被 sponsor 当场抓到 = 致命。

**deck/demo 诚实校准:**
- 「every beat shows an on-chain transaction」改真话:happy-path 1 tx,slash 是关键 tx,PDA 更新是 tx,**Egress 拦截不是 tx**。
- L4 多跳归因若写死 → deck **明说 scripted scenario**。

---

## 8. 仍缺的「卖什么」一句话(Coral 第 2 评判维度)

- Coral 直接问「服务是否差异化」,deck slide 2 要一句话答。
- 锁 TxODDS 后填:**「一个可被任何人复算证明的赛果/赔率预言机,卖错了当场被罚。」**
- 写进 deck slide 2 + README 首行。

---

## 9. 收紧后的执行阶梯(建议替换 §7)

| Rung | 内容 | 验收 |
|---|---|---|
| **L0** | Coral 市场跑通 + 1 笔 devnet 结算 | Explorer 链接;**先验 Windows/WSL 工具链** |
| **L1(脊柱)** | TxODDS hero + bond/escrow + **每次客观再执行 + diff + slash**(verify-then-pay) | 作弊者偏差 → 链上 slash + 赔付买家;消息全走 thread。**独立即 5k 有力竞争者** |
| **L2(信誉)** | 裁决结果 → Solana reputation PDA → bond 随信誉缩放 | 干净 PDA,无 ERC-8004 |
| **L3(装饰)** | Egress 最小拦截器 + reason-code enum(仅 README/deck 提及) | 不进核心 demo |
| **L4(stretch)** | 多跳反事实归因(1 个**明示 scripted** 案例,deck 附录) | 仅有余力 |

**止损线**:L0–L1 = 完整奖项核心;L2 便宜高可信;L3 写一段;L4 可弃。

---

## 10. D0 头号任务:Windows 工具链排雷

整个计划唯一被忽视的单点故障:Solana/Anchor/LiteSVM 在原生 Windows 上很痛,大概率需 WSL2。**今天就跑通 `just dev` + 一笔 tx**,再谈任何机制。优先级高于一切机制争论。

---

## 决策清单(照着勾)

- [ ] **机制**:确认改 verify-then-pay(否则写清乐观的可演示收益)
- [ ] **hero service**:锁定 TxODDS + 一页「判偏差」谓词规格
- [ ] **叙事**:zero-trust → verifiable adjudication
- [ ] **删**:ERC-8004
- [ ] **降级**:Egress PEP → 附录
- [ ] **核实**:全部 arXiv 编号 + 统计数字
- [ ] **校准**:demo「每拍上链」措辞、scripted 归因如实标注
- [ ] **D0**:Windows/WSL 工具链 + L0 一笔 tx
- [ ] **会话**:验证/slash 消息走 thread、窗口在会话内不掉线

---

*生成于评审讨论,作为 `PROPOSAL.md` 的旁注。采纳与否由作者决定。*
