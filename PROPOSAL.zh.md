# 提案 v3（Hybrid）—— Coral 上的「预防 + 乐观验证」问责回路

> **UK AI Agent Hackathon EP5 × Conduct** · DoraHacks #2272 · Coral / CoralOS & STUK 赏金（5,000 USDT）
> 单赛道聚焦 **Coral**（已去掉 Kaspa / Fetch）。链:**Solana + CoralOS**。截止:**2026-07-04 22:59**
> 版本说明:v3 = V1 的「问责愿景」架在 V2 的「乐观+客观重执行机制」上,结算先行,渐变交付。

## 摘要

Coral 给了一个「AI agent 互相买卖服务、用 Solana 自动结算」的开放市场,但它故意留空了最难的一层:**卖家可以撒谎、偷工、摆烂,没人执法。** 我们补这一层——但不是大而全的「四层栈」(V1),也不是一步跳到极简(V2),而是 **hybrid**:用一条**被实战验证的乐观验证-then-pay 机制**当脊柱,再把 V1 的「事前预防 / 信誉」作为低成本层长在上面。最终是一条四段问责流水线 **预防 → 检测 → 结算 → 信誉**,全部跑在 Solana + CoralOS,demo 以「成交 → agent 决定付钱 → 作弊者当场被 slash」为主线。

## 1. 问题(已被现实验证)

agentic 经济正在爆发(x402 九个月 **1.5 亿笔/$50M**,2030 预计 **$3–5T**),但**支付轨道已被商品化**(x402 / Google AP2 / Virtuals ACP / Olas)。真正没解决的是**信任**:

- 普通托管只判二元「交付/没交付」,**判不了质量**;
- A2A 安全甩给实现者 → 冒充、replay、递归 DoS;
- 自评自执的「Logic Monopoly」结构缺陷被量化:**84% 攻击成功率、31% 自发欺骗**([AE4E, arXiv 2603.25100](https://arxiv.org/abs/2603.25100))。

这正是 Coral 的定位(zero-trust、govern、observe)留空、而我们要补的那一层。

## 2. 设计原则:V1 愿景 + V2 机制 + 结算先行

- **V1 错在机制(逐单验+主观罚)和排序(plumbing 先行),不是错在愿景。**
- 现实案例锁定正确机制:UMA/Kleros 用**乐观挑战 + bond**,Chainlink 只罚**客观偏离**,web2(Fiverr/Upwork)用**N天自动放行 + 人工争议**——**没人逐单验主观质量**。
- 我们对 [TessPay(Verify-then-Pay, arXiv 2602.00213)](https://arxiv.org/abs/2602.00213) 的诚实差异点:用 **re-execution(重新执行)作裁决谓词**,**无需 TEE/TLSNotary**——轻一个数量级,6 天做得完。

## 3. 架构:四段问责流水线

```
① 预防 ────────→ ② 检测 ────────→ ③ 结算 ────────→ ④ 信誉
 Egress PEP        乐观挑战            escrow            Solana 信誉 PDA
 (V1,事前拦)      +客观重执行         放行/罚没          + ERC-8004 语义框架
 (扩展 guard.ts)   (V2,被质疑才验)   ↑Coral必过项↑       bond 随信誉缩放
                                                         (stretch:多跳反事实归因)
              └────── 全部在 Solana + CoralOS,单链单赛道 ──────┘
```

- **脊柱 = ②③(V2)**:卖家成交后押 bond → **默认乐观放行**(挑战窗口内无人质疑就 Solana Pay 结清)→ 买家/挑战者可押 bond 质疑 → **Arbiter agent 客观重查(re-quote/重算)→ 输方 bond 罚没重分**(UMA 经济学)。
- **① 预防(V1)**:所有出站动作先过统一 **Egress PEP**(allowlist / 预算 / velocity / replay-nonce / schema / 完整性 hash + 审计日志)。V2 只有事后,这补上事前 → **「预防+检测」双闭环**,比 TessPay/UMA 都完整。
- **④ 信誉(V1,轻)**:挑战结果写入 **Solana 信誉 PDA**,bond 大小随信誉缩放(分级信任);用 **ERC-8004** 的 Identity/Reputation/Validation 给整条脊柱命名(框架词,零额外工程)。
- **stretch**:多跳交易的反事实失败归因(脚本化 1 例,放 deck 末页,不进核心 demo)。

## 4. 为什么 hybrid 同时强于 V1 和 V2

| | V1(四层栈) | V2(极简) | **v3 Hybrid** |
|---|---|---|---|
| 验证模型 | 逐单验(贵/脆) | 乐观挑战 | **乐观挑战**(承 V2) |
| 裁决 | 主观打分 | 客观重执行 | **客观重执行**(承 V2) |
| 事前预防 | 有(Egress) | 无 | **有(承 V1)→ 双闭环** |
| 信誉/标准 | Kaspa+ERC-8004(重) | 几乎无 | **Solana PDA + ERC-8004 命名(轻)** |
| 原创撞车 | 高(撞 TessPay) | 低 | **低**(re-execution 差异点) |
| 范围/6天 | 超载 | 偏薄 | **渐变阶梯,刚好** |
| 链 | 三链 | 单链 | **单链(Solana)** |

## 5. 单链聚焦带来的简化(去掉 Kaspa/Fetch)
- 三链 → **Solana + CoralOS**:demo 纯净、无跨链桥、无 Kaspa TN12 风险。
- 信誉从 Kaspa KRC-20 → **Solana PDA**:更简单,且命中 Coral「on-chain reputation layer」加分。
- 全部精力压在一条回路 → 把 Coral 这一关做到满分。

## 6. Hero 服务(候选,**暂不定死**)

**选择原则**:hero 服务的质量必须能被**客观重执行验证**,否则 slash 立不住(这淘汰了 Claude 推理这类主观服务)。三个候选各代表一种验证范式:

| 候选 | 验证范式 | 优势 | 代价 |
|---|---|---|---|
| Jupiter 验证最优成交 | 重做比对 | slash 最脆爽、工程最低 | 是 kit 默认,差异化弱 |
| Helius 钱包风险分 | 重算公式 | 差异化最高、主题合体 | 需先定死确定性 rubric |
| TxODDS 赛果预言机 | 验证证明 | 密码学验证、组织方加分 | 中等工程、可能撞车 |

> 暂留为待定;最契合「客观重执行」脊柱的是 **Jupiter re-quote**,但最终由你拍。可「主打一个 + 挂一个次要服务」。

## 7. 渐变构建阶梯(每级都是可交付的 Coral 提交)

| 级 | 内容 | 说明 |
|---|---|---|
| **L0** | Coral 基础市场跑通 + 一笔真实 devnet 结算(Explorer link) | Coral 最低要求 |
| **L1（脊柱）** | bond + escrow + **乐观挑战 + 客观重执行 + slash** | V2 核心,**独立成立即可争 5k** |
| **L2（+预防）** | **Egress PEP** + 审计日志 + reason-code 分类 | V1 预防层,「prevent+detect」双闭环 |
| **L3（+信誉）** | 挑战结果 → **Solana 信誉 PDA** → bond 随信誉缩放;ERC-8004 命名 | V1 信誉/框架 |
| **L4（stretch）** | 多跳反事实归因(脚本化 1 例) | V1 科研,deck 末页 |

**止损**:L0–L1 = 完整夺奖核心;L2/L3 低成本高说服力;L4 有时间才碰。

## 8. Coral 评审对照

> 注:Coral 正式 rubric 仍 "dropping soon",以下依据截至 6/28 的 track/submission 指引,待公布后复核(去 Discord `discord.gg/tRnC3YjMV` 确认权重)。

- [ ] 至少一笔真实 devnet 交易 + Explorer `?cluster=devnet` 链接（①真的结算了吗)
- [ ] CoralOS（MCP）会话 thread 内协调,非侧信道——**Verifier/挑战消息也走 thread**
- [ ] Solana Pay:recipient + amount + **唯一 reference**
- [ ] 服务差异化（②）/ agentic depth:买家/卖家/挑战者/Arbiter 都在**决策并行动**（③）
- [ ] 加分（⑤）:智能合约(bond/escrow/slash)+ 多 agent 图 + on-chain 信誉
- [ ] 开源 repo + README + 3–6 页 deck + ≤3min 视频(**实时结算**)

## 9. Demo 脚本（「proof slide wins」)
1. **正常一轮** —— 买家发需求 → 卖家竞价 → 赢家交付 + 押 bond → 挑战窗口无人质疑 → **Solana Pay 自动结清**(Explorer link)。
2. **投放作弊者** —— 最低价、偏差/垃圾交付。
3. **挑战 + 客观重执行** —— 挑战者押 bond → Arbiter **重新执行比对** → 判定偏离 → **输方 bond 链上罚没重分**(Explorer link);信誉 PDA 下调。
4. **(可选)Egress 拦截** —— 展示一个明显越界动作被事前 PEP 直接拦下 + 审计日志。
5. **(stretch)多跳** —— brokered 交易失败 → 反事实归因点名真凶。

每一拍都有一笔链上交易。

## 10. Pitch deck 大纲（5 页)
1. **客户与问题** —— 开放 agent 市场没有问责(引 84%/31%)。
2. **卖什么** —— hero `deliverService` 一句话。
3. **凭什么可信** —— 预防(Egress)+ 乐观验证(挑战+重执行)+ 罚没 + 信誉。
4. **经济体** —— 买家/卖家/挑战者/Arbiter 的 agent 图(单链 Solana)。
5. **证明** —— 实时结算 + slash,Explorer 链接。*(这页定胜负。)*

## 11. 仍站得住的 novelty（收窄但真实)

> 「把乐观预言机式争议裁决(UMA/Kleros)带进 A2A **服务质量**结算,用 **re-execution 作可自动化的裁决谓词**(无需 TEE/TLSNotary),并叠加**事前 Egress 预防**形成 prevent+detect 双闭环——落在 Solana/CoralOS 上。」

真实市场(Upwork/Fiverr)靠**人工**争议;crypto 预言机靠**乐观 bond**;我们把后者带进 agent *服务* 市场且**裁决可自动化 + 事前可预防**。窄、真、未被产品化。ERC-8004 / 反事实归因 作背景/future work,不overclaim。

## 12. 风险与对策

| 风险 | 对策 |
|---|---|
| Coral rubric 未定稿 | 先去 Discord 确认权重;以 track 指引为准并标注 |
| Anchor/Rust(bond/escrow/slash)是硬骨头 | 用 `solana-dev` skill 脚手架;保底用「押金到程序地址 + transfer 罚没」轻量替代,不强写自定义指令 |
| 范围超载 | L0–L4 阶梯 + 止损:L0–L1 即可成立 |
| 撞 TessPay/已商品化 | 收窄到 re-execution + prevent+detect,作诚实差异点 |
| slash 不可信 | 只用**客观可重执行**的 hero 服务 |

## 13. 参考
- [TessPay — Verify-then-Pay (arXiv 2602.00213)](https://arxiv.org/abs/2602.00213) · [AE4E 权力分立 (arXiv 2603.25100)](https://arxiv.org/abs/2603.25100)
- [UMA 乐观预言机](https://www.polysyncer.net/blog/polymarket-uma-oracle-explained/) · [Kleros vs UMA](https://blog.kleros.io/kleros-and-uma-a-comparison-of-schelling-point-based-blockchain-oracles/) · [EigenLayer 2026](https://blockeden.xyz/blog/2026/03/20/eigenlayer-18b-tvl-vertical-avs-specialization-restaking-evolution/)
- [Coinbase x402+AP2](https://www.coinbase.com/developer-platform/discover/launches/google_x402) · [Virtuals ACP](https://www.dextools.io/tutorials/what-is-virtuals-protocol-ai-agents-base-guide-2026) · [ERC-8004 EIP](https://eips.ethereum.org/EIPS/eip-8004)
- Coral starter kit [github.com/trilltino/solana_coralOS](https://github.com/trilltino/solana_coralOS) · 本地知识库 `coral-knowledge/`
</content>
