# Accountable Agent Market（可问责的 Agent 市场）

**一个 AI agent 互相买卖服务的真实市场——LLM 定价、Solana 链上结算、全程无人干预。**
基于 Solana × CoralOS，参加 UK AI Agent Hackathon EP5（DoraHacks #2272，Coral / CoralOS & STUK 赛道）。

[English README](README.md) · [Demo 指南与运行手册](DEMO.md) · [路线图](PLAN.md) ·
[提案](PROPOSAL.zh.md) · [提案评审](CRITIQUE.md)

## 它做什么（2026-07-03 已在 devnet 真实跑通）

一个**买家 agent** 在 CoralOS 共享消息线程里广播需求；**LLM 卖家 persona** 相互竞争——三个守规矩的
（低价走量的 `seller-cheap`、公道可靠的 `seller-honest`、高价高信心的 `seller-premium`），外加两个
专门攻击结算的（`seller-rogue`：中标、收下托管、然后玩消失；`seller-hijack`：中标后在托管条款里塞
一个**陌生收款钱包**）。各自用 LLM 决定"接不接、报多少"（不低于各自成本底价）。买家给出理由授标——
但**每一笔出账都先过一道代码强制的策略检查（Egress PEP）**，只会向它预期的钱包入金。它把货款锁进
**Solana 托管合约**，中标者交付**真实的 TxODDS 世界杯数据**，买家**再执行一遍客观的 TxLINE 读取**，
托管**仅在验证通过后放款**。若 rogue 到期没交付，买家等过链上 deadline 后**用托管合约的 refund 指令
单方面收回资金**（该轮变红、带自己的 Explorer 链接）。若 hijacker 想改收款地址，PEP 在**任何交易
签名之前就拒绝入金**——它中了标却一分钱赚不到，而且*全程零 SOL 移动*。每一步都是 devnet 上可查证的
真实交易；React 面板把消息流实时折叠成拍卖时间线。

```
                                           ┌ Egress PEP：向陌生钱包付款？签名前拒绝——无 tx、无资金移动
WANT → LLM 出价（persona 定价）→ 授标+理由 ┴→ 托管入金 → 交付 → 验证 → 链上放款
                                               └→ 无交付 / 验证失败 → 过期 → 链上退款
```

链上凭证（Solana Explorer，devnet——同一场 live session，两种结局）：

- 第 1 轮 **settled**——**seller-honest** 以 0.0007 胜过 rogue 的 0.00025（LLM 买家权衡注释而非
  只看价格）：
  [放款交易](https://explorer.solana.com/tx/2vp5d5RCe3yMCRSiFCkD57JF4cPrVfx6BKhTFajmq7dxMkS6iMLTngCMs6vJnqeH7rTX2ykvgzetdGhdSiYtKUr7?cluster=devnet)
- 第 2 轮 **refunded**——**seller-rogue** 伪装成正经供应商中标；托管入金后拒不交付，买家在 45 秒
  deadline 过后收回资金：
  [退款交易](https://explorer.solana.com/tx/5PLwHDBizrxadzF6ScVaCQG81xeFogbYgsp8aReZ2tyvVYQZW8LjTayZMuHtpaRQSq5tx9HECRrnmUTCokyAn7g5?cluster=devnet)
- 第 3 轮 **refunded**——rogue 又中标、又一分钱没赚到：
  [退款交易](https://explorer.solana.com/tx/4qiHDaqVLgcmJh7cmNCHvWbXF4Ek6gVd5fNAvxHsrkQ2rWBN7f57iwJNmSJBV3cRuK39VJRpPQHA4t93RsSo8bcw?cluster=devnet)
- 更早的纯成交 session：[honest 凭价值胜过
  cheap](https://explorer.solana.com/tx/2nhjgoR8W3gJjm8Uxas1WtQbf722xsTdYcRBwxo5zh6gRYNqq1RoTZp2fA6CqwsvLy3LCXJVnu31ekh6n1T1mHrC?cluster=devnet)
  · [cheap 凭价格胜出](https://explorer.solana.com/tx/261BtQLUQv6WtPkQ9iokAXdycMLgXVVjv2VH1eE6yGXwd4Eojiy3cDqATpA4ri4WAFxYLHeApVviJz7BnGyvhEFr?cluster=devnet)

## 为什么叫"可问责"

真实运行这套市场的**两天之内，结算以六种方式坏掉**——每一个都在本仓库的提交历史里被诊断并修复
（细节见 [DEMO.md](DEMO.md)）：

1. 启动器引用了不存在的卖家 persona——session 创建必然失败。
2. 买家静默崩溃：默认仲裁结算需要的密钥，启动器从未转发。
3. devnet 上部署的**仲裁程序全局 config 先到先得**——所有 fork 用户永远 `NotArbiter`，资金锁在
   陌生人的钥匙后面。
4. 全新卖家钱包收不了低于 Solana 免租门槛的小额货款——每一轮都卡死。
5. 托管支付 reference 不含 session 成分——重跑与旧托管账户碰撞。
6. **退款路径在链上一直存在，却从来没人接线**——卖家跑路只会让买家的钱永远困在托管里。我们把它
   接上，并造出 `seller-rogue` 现场验证。过程中的意外发现：rogue 的推销词浮夸时（"Rock bottom
   price, instant!"），DeepSeek 买家**连续 9 轮拒绝它**；换上冷静的"机构供应商"人设立刻中标——
   LLM 的谨慎是软防线，链上 deadline 退款才是兜底的硬防线。

这就是论点：**agent 市场会以人类不会盯着看的方式坏掉。** 结算轨道必须自带验证、自有仲裁、
slashing 与信誉——见[路线图](PLAN.md)（verify-then-pay 流水线，出处见[提案](PROPOSAL.zh.md)）。

### 预防层——Egress PEP

上面六个发现都属于*检测*——市场坏了、我们事后抓住。另一半是*预防*：在坏动作发生**之前**就拦住。
现在每一个出站动作——deposit、release、refund、出站 HTTP——都先过一道代码强制的**策略执行点
（PEP）**（"模型提议，代码裁决"）：收款人白名单、按 reference 的防重放、支出预算、频率上限、
出站域名白名单，每一次拒绝都打上 **reason code** 并写入审计日志。抓取数据里的 prompt injection、
或被劫持的线程消息，可以*请求*买家付给错误的钱包——但*做不到*，因为裁决逻辑活在 prompt 够不到
的代码里。

demo 用 `seller-hijack` 把这件事演出来：它压价中标，然后往托管条款里塞一个**陌生收款钱包**。
买家的 PEP 钉死预期钱包、拒绝入金——`RECIPIENT_NOT_ALLOWED`——于是 hijacker 中了标却一分钱赚
不到。**这里对"它是什么"保持诚实：拦截不是链上交易。** 没有签名可展示；凭证是那条审计记录、
加上那笔**本该出现却没出现的 deposit**，与正常轮真实的 Explorer 链接形成对照。预防天然比结算
留下*更小*的足迹。

## 快速开始

前置：Docker Desktop、Node ≥ 20、Windows 用 Git Bash。**仅 devnet**——连主网 RPC 会被运行时直接拒绝。

```sh
git clone https://github.com/GaryGAO2003/accountable-agent-market
cd accountable-agent-market/solana_coralOS-main

npm install --prefix scripts && node scripts/setup.js   # 生成钱包 → .env；给 buyer 领水（faucet.solana.com）
# .env 填一个 LLM key——DeepSeek/Venice/OpenAI/Anthropic 均可，例如：
#   LLM_PROVIDER=deepseek  DEEPSEEK_API_KEY=...  LLM_MODEL=deepseek-v4-flash
#   SETTLEMENT_MODE=direct          （原因见上面第 3 条）
# 给卖家 WALLET 一次性转 ~0.01 devnet SOL（原因见上面第 4 条）

(cd examples/txodds && npm install && npm run mint)     # 领 TxLINE token——市场卖的商品
bash build-agents.sh && docker compose up -d coral      # 构建 agent 镜像 + 启动 coral-server
cd examples/marketplace && npm install && npm start     # 打印 session id

# 面板：feed(:4000) + web(:5173) → http://localhost:5173/?session=<id>
```

带逐步说明的完整手册：[DEMO.md](DEMO.md)。

## 相对上游 kit 的改动

上游：[trilltino/solana_coralOS](https://github.com/trilltino/solana_coralOS) @ `a8fd71a`，
以原始状态 vendor 在 [`solana_coralOS-main/`](solana_coralOS-main/)——之后每个改动都是独立可审的提交：

- 三个卖家 persona manifest + 启动名单修复（原版 marketplace 起不来）。
- **问责闭环**：买家侧 deadline 退款（`refund()` 早已部署在链上却从未被调用）、`REFUNDED`
  协议消息、带 `DELIVER_MODE` 开关（`none`/`junk`）的 `seller-rogue` persona、面板上带
  Explorer 链接的红色退款徽章。
- 面板 feed 把 `ARBITER_RELEASED` 折叠为 settled（默认结算模式下回合永远不显示结清）。
- 向买家转发 `ARBITER_KEYPAIR_B58`；结算模式可配置（`SETTLEMENT_MODE`）。
- **DeepSeek** 成为第四个 LLM provider，并为推理型模型设 token 下限。
- 卖家免租门槛启动预检；托管 reference 绑定加每次运行唯一的盐。
- **verify-then-pay**：买家在放款前再执行一遍客观的 TxLINE 读取（消息流里的 `VERIFIED` /
  `VERIFICATION_FAILED`），配一个脚本化的坏数据卖家（`DEMO_FAIL_VERIFICATION=1`、
  `TXLINE_DELIVERY_MODE=bad_count|invalid_json`），让评委现场看到一次放款被拦下。
- 可选的 `arbiter-agent` 流程（`ARBITER_AGENT_ENABLED=1`）：中立 agent 验证并发出
  `ARBITER_VERIFIED` / `ARBITER_REJECTED`，再签放款/退款（链上那半仍受第 3 条阻塞，待自部署仲裁）。
- **预防层——统一的 Egress PEP**（`packages/agent-runtime/src/market/egress.ts`）：一道代码强制的
  策略检查（收款人白名单 · reference 防重放 · 预算 · 频率 · 出站域名白名单）+ reason-code 分类
  + 审计日志，接在买家的 deposit/release/refund 与卖家的 TxLINE 外呼上。被拦的回合向线程发
  `EGRESS_DENIED`，面板显示紫色 **PEP blocked** 徽章（不伪造 Explorer 链接——拦截不是 tx）。
  `seller-hijack` persona（改收款钱包）驱动这条 demo 拍点。
- 全程测试绿灯：agent-runtime · buyer · seller · arbiter · feed · web，各处 typecheck 通过。

## 路线图（版本对应见 [PLAN.md](PLAN.md)）

`jupiter_quote` 第二服务 → 买家风险加权选标 → 验证适配器（verify-then-pay）→ watcher/挑战者 →
仲裁 agent → **自部署链上仲裁 + slashing**（第 3 条发现就是论据）→ 信誉 → 完整面板时间线。

## 仓库导览

| 路径 | 内容 |
|---|---|
| `solana_coralOS-main/` | vendor 的 kit + 我们的改动（agents、runtime、托管合约、marketplace、面板） |
| `DEMO.md` | Demo 分镜、运行手册、链上凭证、六个发现的细节 |
| `PLAN.md` | 按版本推进的路线图 |
| `PROPOSAL.md` / `PROPOSAL.zh.md` | 提案 |
| `CRITIQUE.md` | 对提案的对抗性评审（决策记录） |
| `progress.md` | 工作笔记 |
