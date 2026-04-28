---
name: gsd:spec-phase
description: 苏格拉底式规格细化，在 discuss-phase 之前通过歧义评分澄清某个 phase 交付 WHAT。产出 SPEC.md，在实现决策开始前锁定可证伪的需求。
argument-hint: "<phase> [--auto] [--text]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
通过结构化的苏格拉底式提问，并结合量化歧义评分，澄清 phase 需求。

**在工作流中的位置：** `spec-phase → discuss-phase → plan-phase → execute-phase → verify`

**工作方式：**
1. 加载 phase 上下文（PROJECT.md、REQUIREMENTS.md、ROADMAP.md、STATE.md）
2. 先勘察代码库，在提问前了解当前状态
3. 运行苏格拉底式访谈循环（最多 6 轮，轮换视角）
4. 每轮结束后按 4 个加权维度给歧义打分
5. 关卡：歧义 ≤ 0.20 且所有维度达到最低要求 → 写入 SPEC.md
6. 提交 SPEC.md，discuss-phase 下次运行时会自动接手

**输出：** `{phase_dir}/{padded_phase}-SPEC.md` — 在 discuss-phase 处理 “how” 之前，先锁定 “what/why” 的可证伪需求
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/spec-phase.md
@~/.claude/get-shit-done/templates/spec.md
</execution_context>

<runtime_note>
**Copilot (VS Code)：** 凡是该工作流调用 `AskUserQuestion` 的地方，都改用 `vscode_askquestions`。两者等价。
</runtime_note>

<context>
Phase 编号：$ARGUMENTS（必填）

**Flags：**
- `--auto` — 跳过交互式提问；由 Claude 选择推荐默认值并写入 SPEC.md
- `--text` — 使用纯文本编号列表而不是 TUI 菜单（`/rc` 远程会话必须使用）

上下文文件会在工作流内通过 `init phase-op` 解析。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/spec-phase.md` 中的 spec-phase 工作流。

**强制要求：** 在采取任何行动前先读取工作流文件。工作流中包含完整的逐步流程，包括苏格拉底式访谈循环、歧义评分关卡和 SPEC.md 生成。不要仅根据上面的目标摘要自行发挥。
</process>

<success_criteria>
- 在开始提问前已勘察代码库并了解当前状态
- 每轮访谈后都对全部 4 个歧义维度打分
- 已通过关卡：歧义 ≤ 0.20 且所有维度最低要求均满足
- 已写出包含可证伪需求、明确边界和验收标准的 SPEC.md
- 已原子性提交 SPEC.md
- 用户知道现在可以运行 /gsd-discuss-phase，它会自动加载 SPEC.md
</success_criteria>
