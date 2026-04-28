# 思考伙伴集成

在工作流决策点进行有条件的扩展思考。当 `.planning/config.json` 中 `features.thinking_partner: true` 时启用（默认：false）。

---

## 权衡检测信号

当开发者的回复中出现表明存在竞争性优先级的特定信号时，thinking partner 会被激活：

**关键词信号：**
- 用 "or" / "versus" / "vs" 连接两种方案
- "tradeoff" / "trade-off" / "tradeoffs"
- "on one hand" / "on the other hand"
- "pros and cons"
- "not sure between" / "torn between"

**结构信号：**
- 开发者列出 2 个以上相互竞争的选项
- 开发者问 “which is better” 或 “what would you recommend”
- 开发者推翻先前决定（“actually, maybe we should...”）

**不应激活的情况：**
- 开发者已经做出明确选择
- 这里的 “or” 只是修辞或琐碎问题（例如 “tabs or spaces”，应遵循项目约定）
- 简单的是/否问题
- 开发者明确要求继续往下走

---

## 集成点

### 1. Discuss 阶段 — 深入分析权衡

**何时：** 在 `discuss_areas` 步骤中，当开发者的回答暴露出相互竞争的优先级之后。

**做什么：** 暂停正常提问流程，并提供简短的结构化分析：
```
我注意到这里有相互竞争的优先级：{X} 优化的是 {A}，而 {Y} 优化的是 {B}。

要我在我们做决定前先梳理一下这些权衡吗？
[是，分析权衡] / [不，我已经决定了]
```

如果回答 yes，则提供一段简短分析（3-5 个 bullet），覆盖：
- 每种方案分别优化什么
- 每种方案分别牺牲什么
- 哪一种更符合项目的既定目标（来自 PROJECT.md）
- 带理由的推荐

然后回到正常讨论流程。

### 2. Plan 阶段 — 架构决策分析

**何时：** 在步骤 11（Handle Checker Return）期间，当 plan-checker 标出的问题中含有架构权衡关键词时。

**做什么：** 在送入 revision loop 前，先分析这个架构决策：
```
plan-checker 标出了一个架构权衡问题：{issue description}

简要分析：
- 方案 A：{approach} — {pros/cons}
- 方案 B：{approach} — {pros/cons}
- 建议：{choice}，因为 {reasoning aligned with phase goals}

要把这个建议应用到修订中吗？[是] / [不，我自己决定]
```

### 3. Explore — 方案比较（需要 #1729）

**何时：** 在苏格拉底式对话期间，当出现多个可行方案时。
**注意：** 这个集成点会在 /gsd-explore (#1729) 落地后加入。

---

## 配置

```json
{
  "features": {
    "thinking_partner": true
  }
}
```

默认值：`false`。思考伙伴采用 opt-in，因为它会给交互式工作流增加延迟。

---

## 设计原则

1. **Lightweight** — 内联分析，不开独立交互会话
2. **Opt-in** — 必须显式启用，默认永不激活
3. **Skippable** — 始终提供 “No, I've decided” 以便跳过
4. **Brief** — 最多 3-5 个 bullet，而不是完整研究报告
5. **Aligned** — 有条件时，推荐会引用 PROJECT.md 中的目标
