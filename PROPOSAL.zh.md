# 提案 —— 开放 Agent 经济的「问责层」

> **UK AI Agent Hackathon EP5 × Conduct** · DoraHacks #2272
> 单个 BUIDL 同时冲 **Coral（5,000 USDT）+ Fetch.ai（1,000 USDT）+ Kaspa（1,000 USDC）**
> 提交截止：**2026-07-04 22:59**

## 摘要

Coral 提供了一个「AI agent 互相买卖服务、用 Solana 自动结算」的开放市场,但它有个大洞:**卖家可以骗钱、交垃圾,没人执法。** 我们补的就是这个洞——一套四层**问责栈**:事前拦截 → 出错兜底 → 标准化信任 → 打分罚款+追责,让乱来的 agent 当场被抓、罚没押金、烧掉信誉。三条链各司其职:**Solana 管钱与罚款、Kaspa 管可携带的信誉身份、Fetch 管自然语言发现**。新颖性来自对齐真实标准 **ERC-8004**(并首次搬到非 EVM 的 Solana+Kaspa),并补上它留空的「执法」与「失败归因」。

---

## 1. 问题

开放的 agent-to-agent(A2A)市场让任何 agent 都能广告服务、收钱。难点不在撮合买卖,而在**信任陌生人**:

- 卖家会**撒谎、偷工、摆烂**。普通托管只能判二元「交付了/没交付」,**判不了质量**。
- A2A 自身的安全**完全甩给实现者** → 假 agent 广告、agent card 篡改、replay 重放、递归委派 DoS、无语义校验([arXiv 2602.11327](https://arxiv.org/html/2602.11327v2))。
- 当**多跳交易**(broker → seller → oracle)失败时,**没人说得清是谁的锅**。

这正是 2026 年「多智能体可信度反扑」的根因:多 agent 系统常常赢不了单 agent,**就是因为缺乏问责**。

Coral 自己的定位是 *「zero-trust 协调基础设施……compose、**govern、observe**、scale 生产级 agent 系统」*。starter kit 给了市场,却**故意把信任/治理层留空**。**我们来补这一层。**

## 2. 方案 —— 四层问责栈

```
出站动作（bid / deliver / pay / message）
        │
   ① EGRESS PEP ............ 预防：动作落地前先过策略闸
        │                    （allowlist · 预算 · velocity · replay-nonce · schema · 完整性hash · 审计日志）
        ▼
   ② WEB2 反欺诈/容错 ....... 运营：幂等键 · 退避重试 · 熔断 ·
        │                    争议窗口（=chargeback）· 异常/velocity 检测 ·
        │                    分级信任额度 · 「拒付理由码」分类法
        ▼
   ③ ERC-8004 信任三件套 .... 标准：Identity / Reputation / Validation 三注册表
        │                    跨 Solana（PDA）+ Kaspa（KRC-20）实现 —— 非 EVM 首例
        ▼
   ④ 执法 + 归因 ............ 执法：Verifier 给质量打分 → 理由码 →
                             Solana 罚没押金 + Kaspa 烧信誉 +
                             多跳交易的反事实失败归因
```

### ① Egress PEP（预防层）
一个所有 agent 出站动作**落地前必过**的统一策略执行点。Coral 现在已经在代码里强制 budget/floor/allowed-recipients(`guard.ts`)——我们把它抽成一等公民的 **egress 网关** + 结构化审计日志。每个检查项直接对应一类 A2A 已知攻击:

| 检查项 | 挡住的 A2A 攻击 |
|---|---|
| recipient allowlist(仅 402 challenge 出现过的) | 钓鱼收款 / card 篡改 |
| replay nonce + 唯一 `reference` | replay 重放 |
| velocity / 限频 | 递归委派 DoS |
| schema + 语义校验 | prompt 注入 / 假能力广告 |
| 防篡改审计日志 | 喂给 ③ 信誉 & ④ 归因 |

### ② Web2 反欺诈/容错（运营层)
把成熟的互联网模式搬进 agent 经济:
- **错误处理**:HTTP 语义(Coral 已用 402)· **幂等键**(重试不双扣)· 指数退避+抖动 · **熔断**(连续失败的卖家停止派单)· 死信队列 → 争议。
- **欺诈处理**:**争议窗口 = chargeback**(托管退款 deadline + `arbitrate`)· 异常/velocity 检测(抓 sybil & 合谋)· **分级信任额度**(新/低信誉 agent 低额度,信誉解锁额度 = Stripe/PayPal 式渐进信任)。
- **杀手锏工件 —— 「拒付理由码」分类法**:仿照信用卡网络的 chargeback reason codes,为 agent 经济定义一套失败理由码(`NON_DELIVERY` · `QUALITY_FAIL` · `TIMEOUT` · `SCHEMA_INVALID` · `FRAUD` · `UPSTREAM_FAULT`)。Verifier 产出理由码,用同一套词表同时驱动**归因、信誉、争议裁决**。

### ③ ERC-8004 信任三件套（标准层)
[ERC-8004「Trustless Agents」](https://eips.ethereum.org/EIPS/eip-8004) 把 Google A2A 扩展出三个链上注册表。**我们首次在非 EVM、跨链(Solana + Kaspa)上实现这三件套。**

| ERC-8004 注册表 | 我们的实现 |
|---|---|
| **Identity Registry** | CoralOS agent + Solana PDA 身份(可选绑定 Kaspa 地址) |
| **Reputation Registry** | **Kaspa KRC-20「信誉护照」**——跨市场可携带 |
| **Validation Registry** | **Verifier/Arbiter agent + Solana `arbitrate` 指令**(质押 = crypto-economic 验证)+ 可选 Pyth/TxLine merkle 证明(cryptographic 验证) |

→ 既对齐真实的 2025/26 标准,又补上 ERC-8004 留空的两块:**执行(罚没)** 与 **失败归因**。

### ④ 执法 + 归因（你的科研护城河)
Verifier 按 WANT 的 spec 给交付**打质量分**(带 rubric 的 LLM-judge)→ 产出**理由码** → **Solana 罚没押金** + **Kaspa 烧信誉**。多跳失败时,用**反事实失败归因**(replay-and-attribute)在罚没前精准定位真凶,不冤枉诚实的中间商。

## 3. 架构 —— 三个正交关注点,一链一职

| 关注点 | 链 | 职责 |
|---|---|---|
| **钱 / 执行** | **Solana**(Coral) | 交付托管 + arbiter + `arbitrate` + 质押/罚没 |
| **身份 / 信誉** | **Kaspa** | 可携带的 KRC-20 信誉护照(Kasplex Kiwi JS SDK,TN11) |
| **发现 / 交互** | **Fetch.ai** | uAgent + Chat Protocol 上 Agentverse,经 ASI:One 被发现 |

**Solana = 这单的钱与风险;Kaspa = 超越单笔交易的长期身份;Fetch = 你怎么被找到。** 三者不重叠、各自承重。

## 4. 新颖性陈述（可直接进 pitch / abstract)

> *ERC-8004 定义了信任**注册表**,却把**执行**与**失败归因**留作抽象,且仅限 EVM;A2A 定义了 agent **通信**,却把**安全**甩给实现者(冒充、replay、递归 DoS)。我们同时补上这两个缺口:在 CoralOS/A2A 市场上,跨 Solana + Kaspa(非 EVM 首例)实现 ERC-8004 信任三件套,前置一个 **egress 策略执行点**(预防)与 **web2 级反欺诈/容错**(韧性),并以**反事实失败归因**作为 Validation 的大脑。预防 + 标准 + 执行 + 归因 —— 开放 agent 经济的首个端到端问责栈。*

## 5. 自建 vs 复用

| 组件 | 自建 / 复用 |
|---|---|
| CoralOS 市场、托管(`initialize/release/refund`)、买/卖/broker、dashboard | **复用**(`solana_coralOS` starter kit) |
| 差异化 `deliverService()` | 自建(小改) |
| Egress PEP + 审计日志 | 自建(扩展 `guard.ts`) |
| 理由码分类 + 争议窗口 + 幂等/熔断 | 自建(多为应用层逻辑) |
| Verifier/Arbiter agent(新 agent #4) | 自建 |
| Solana `arbitrate` + 质押/罚没 + 信誉 PDA(#5) | 自建(用 `solana-dev` skill → Anchor + LiteSVM) |
| Kaspa KRC-20 信誉护照 | 自建(`@kasplex/kiwi-web`) |
| Fetch uAgent + Chat Protocol 注册 | 自建(Python `uagents`) |
| 反事实归因(3 跳) | 自建(科研叠加层) |

## 6. 三赏金要求对照清单

**Coral(必过):**
- [ ] 至少一笔真实 devnet 交易 + Solana Explorer `?cluster=devnet` 链接
- [ ] CoralOS(MCP)在**会话 thread** 内协调(非私有侧信道)
- [ ] Solana Pay:recipient + amount + **唯一 reference**
- [ ] 开源 repo + README(一键运行)
- [ ] Pitch deck(3–6 页)+ demo 视频(≤3 分钟)展示**实时结算**
- [ ] 加分:智能合约扩展(arbiter/`arbitrate` + 质押/罚没)✅

**Fetch.ai:**
- [ ] agent 注册到 **Agentverse**,可经 **ASI:One** 发现并使用
- [ ] 核心用例可在 ASI:One 对话内演示(Chat Protocol)

**Kaspa:**
- [ ] Kaspa 作为**可编程协调/承诺层,而非支付轨道**(KRC-20 信誉护照,由裁决铸造/销毁)

## 7. 6 天计划（每一级都可交付,带止损)

1. **D1 — Coral 保底**:克隆 kit,devnet 跑通,改 `deliverService()`,落一笔**真实结算 + Explorer 链接**。
2. **D2–3 — Coral 夺奖路径**:Verifier agent + `arbitrate` + 质押/罚没 + 信誉 PDA(用 `solana-dev`)。Demo:作弊者交垃圾 → 链上罚没。*(锁定 5k。)*
3. **D3 — Egress PEP + 理由码 + 争议窗口**:抽 `guard.ts` 成统一模块 + 审计日志 + 理由码分类(成本低、novelty 高)。
4. **D3.5 — Fetch(+1k)**:uAgent + Chat Protocol + Agentverse;从 ASI:One 触发市场。
5. **D4 — Kaspa(+1k)**:Kiwi 铸造 KRC-20 信誉护照;裁决 → 铸造/销毁。*(中午决策点:Kiwi 不顺则降级到最小铸造+转账。)*
6. **D5 — 差异化**:3 跳反事实归因 + 自进化卖家叠加 + dashboard(质押/信誉/归因图)。
7. **D6 — 打包**:≤3 分钟视频(以实时结算开场)、5 页 deck、README、Explorer 链接;DoraHacks 申请全部 3 个赏金 + 邮件 `xforce94@gmail.com` + 各 sponsor Discord 发帖。

**止损**:D1–D4 单独 = 强 Coral + Fetch(≈6k)。Kaspa 是唯一真风险项,且已降级到成熟的 KRC-20 工具链。

## 8. Demo 脚本（Coral:「proof slide wins」)

1. **正常一轮** —— 用户经 ASI:One 找到市场 → 卖家竞价 → 赢家交付 → 托管放款(Explorer 链接)。
2. **投放作弊者** —— 最低价、垃圾交付。
3. **Egress + Verifier** —— egress 记录动作;Verifier 判 `QUALITY_FAIL` → **Solana 罚没押金 + Kaspa 烧信誉**(双链 Explorer 链接)。
4. **多跳失败** —— 一笔 brokered 交易失败;**反事实归因点名真凶**(而非 broker)。
5. **收敛曲线** —— 开启问责后,市场收敛到诚实行为。

每一拍都有一笔链上交易。

## 9. Pitch deck 大纲（5 页)

1. **客户与问题** —— 开放 agent 市场没有问责。
2. **卖什么** —— `deliverService` + 其上的问责层。
3. **凭什么付钱/可信** —— egress 预防、web2 运营、ERC-8004 标准、罚没+归因执行。
4. **经济体** —— 跨 3 链的 agent 图(买/卖/broker/verifier)。
5. **证明** —— 实时结算 + 罚没,Explorer 链接。*(这页定胜负。)*

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| Kaspa SilverScript covenant 太生(TN12、Rust、无 WASM) | 基线用 **KRC-20 + Kasplex Kiwi(JS、TN11)**;covenant 仅作 stretch |
| 范围(6 天 3 条链) | 检查点阶梯 + 止损:Kaspa 掉了仍保 Coral+Fetch(≈6k) |
| Coral 评委要结算不是只要科研 | D1 先落一笔真实交易再叠科研;demo 以「proof slide」开场 |
| 反事实归因做太泛 | 锁定一个脚本化 3 跳失败 + replay,不做通用引擎 |

## 11. 参考文献

- ERC-8004 Trustless Agents —— [EIP](https://eips.ethereum.org/EIPS/eip-8004) · [开发指南](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/)
- A2A 安全威胁建模 —— [arXiv 2602.11327](https://arxiv.org/html/2602.11327v2) · [改进 A2A](https://arxiv.org/html/2505.12490v3)
- AI agent egress / guardrails —— [Galileo guardrails 综述](https://galileo.ai/blog/best-ai-agent-guardrails-solutions)
- Coral starter kit —— [github.com/trilltino/solana_coralOS](https://github.com/trilltino/solana_coralOS)
- Kaspa KRC-20 —— [Kasplex 文档](https://docs-kasplex.gitbook.io/krc20) · [Kiwi web SDK](https://www.npmjs.com/package/@kasplex/kiwi-web)
- Fetch.ai —— [ASI:One uAgent 示例](https://uagents.fetch.ai/docs/examples/asi-1) · [Agentverse 上线指南](https://docs.agentverse.ai/documentation/launch-agents/launch-asi-one-compatible-u-agent)
- 本地知识库 —— `coral-knowledge/`(CoralOS、Solana 托管、代码 kit、提交规则)
</content>
