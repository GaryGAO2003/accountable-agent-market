# Accountable Agent Market（可问责的 Agent 市场）

**一个 AI agent 互相买卖服务的真实市场——LLM 定价、Solana 链上结算、全程无人干预。**
基于 Solana × CoralOS，参加 UK AI Agent Hackathon EP5（DoraHacks #2272，Coral / CoralOS & STUK 赛道）。

[English README](README.md) · [Demo 指南与运行手册](DEMO.md) · [路线图](PLAN.md) ·
[提案](PROPOSAL.zh.md) · [提案评审](CRITIQUE.md)

## 它做什么（2026-07-03 已在 devnet 真实跑通）

一个**买家 agent** 在 CoralOS 共享消息线程里广播需求；三个 **LLM 卖家 persona**——低价走量的
`seller-cheap`、公道可靠的 `seller-honest`、高价高信心的 `seller-premium`——各自用 LLM 决定
"接不接、报多少"（不低于各自成本底价）。买家给出理由授标，把货款锁进 **Solana 托管合约**，
中标者交付**真实的 TxODDS 世界杯数据**，托管在交付后自动放款。每一步都是 devnet 上可查证的真实
交易；React 面板把消息流实时折叠成拍卖时间线。

```
WANT → 三个 LLM 出价（persona 定价）→ 授标+理由 → 托管入金 → 交付真实数据 → 链上放款
```

链上凭证（Solana Explorer，devnet）：

- 第 1 轮——**seller-honest** 以 0.0005 胜出（LLM 买家权衡注释而非只看价格）：
  [放款交易](https://explorer.solana.com/tx/2nhjgoR8W3gJjm8Uxas1WtQbf722xsTdYcRBwxo5zh6gRYNqq1RoTZp2fA6CqwsvLy3LCXJVnu31ekh6n1T1mHrC?cluster=devnet)
- 第 2 轮——**seller-cheap** 胜出：
  [放款交易](https://explorer.solana.com/tx/261BtQLUQv6WtPkQ9iokAXdycMLgXVVjv2VH1eE6yGXwd4Eojiy3cDqATpA4ri4WAFxYLHeApVviJz7BnGyvhEFr?cluster=devnet)
- 第 3 轮——**seller-honest** 胜出：
  [放款交易](https://explorer.solana.com/tx/2P5brUpoVGicuWuzwbpF8MgEUiZcjYSAQwBGEaE3ZXxAmXBiKTZH7NaBpxBktKVuW3dWiWkUPPAv14uUxZ7bx7hd?cluster=devnet)

## 为什么叫"可问责"

真实运行这套市场的**一天之内，结算以五种方式坏掉**——每一个都在本仓库的提交历史里被诊断并修复
（细节见 [DEMO.md](DEMO.md)）：

1. 启动器引用了不存在的卖家 persona——session 创建必然失败。
2. 买家静默崩溃：默认仲裁结算需要的密钥，启动器从未转发。
3. devnet 上部署的**仲裁程序全局 config 先到先得**——所有 fork 用户永远 `NotArbiter`，资金锁在
   陌生人的钥匙后面。
4. 全新卖家钱包收不了低于 Solana 免租门槛的小额货款——每一轮都卡死。
5. 托管支付 reference 不含 session 成分——重跑与旧托管账户碰撞。

这就是论点：**agent 市场会以人类不会盯着看的方式坏掉。** 结算轨道必须自带验证、自有仲裁、
slashing 与信誉——见[路线图](PLAN.md)（verify-then-pay 流水线，出处见[提案](PROPOSAL.zh.md)）。

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
- 面板 feed 把 `ARBITER_RELEASED` 折叠为 settled（默认结算模式下回合永远不显示结清）。
- 向买家转发 `ARBITER_KEYPAIR_B58`；结算模式可配置（`SETTLEMENT_MODE`）。
- **DeepSeek** 成为第四个 LLM provider，并为推理型模型设 token 下限。
- 卖家免租门槛启动预检；托管 reference 绑定加每次运行唯一的盐。
- 全程测试绿灯：agent-runtime 37/37 · feed 9/9 · web 5/5（各处 typecheck 通过）。

## 路线图（版本对应见 [PLAN.md](PLAN.md)）

`jupiter_quote` 第二服务 → 买家风险加权选标 → 验证适配器（verify-then-pay）→ watcher/挑战者 →
仲裁 agent → **自部署链上仲裁 + slashing**（第 3 条发现就是论据）→ 信誉 → 完整面板时间线。

## 仓库导览

| 路径 | 内容 |
|---|---|
| `solana_coralOS-main/` | vendor 的 kit + 我们的改动（agents、runtime、托管合约、marketplace、面板） |
| `DEMO.md` | Demo 分镜、运行手册、链上凭证、五个发现的细节 |
| `PLAN.md` | 按版本推进的路线图 |
| `PROPOSAL.md` / `PROPOSAL.zh.md` | 提案 |
| `CRITIQUE.md` | 对提案的对抗性评审（决策记录） |
| `progress.md` | 工作笔记 |
