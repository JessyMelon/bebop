---
name: gsd:discuss-phase
description: 在规划前通过自适应提问收集 phase 上下文。使用 `--all` 跳过 area 选择并以交互方式讨论所有灰区。使用 `--auto` 跳过交互式提问（由 Claude 选择推荐默认值）。使用 `--chain` 进行交互式 discuss，然后自动执行 plan+execute。使用 `--power` 批量生成问题到基于文件的 UI 中（你可以按自己的节奏回答）。
argument-hint: "<phase> [--all] [--auto] [--chain] [--batch] [--analyze] [--text] [--power]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

<objective>
提取下游 agents 所需的实现决策，researcher 和 planner 会依靠 `CONTEXT.md` 来了解应调查什么，以及哪些选择已经锁定。

**工作方式：**
1. 加载既有上下文（`PROJECT.md`、`REQUIREMENTS.md`、`STATE.md`、此前的 `CONTEXT.md` 文件）
2. 侦察代码库中的可复用资产和模式
3. 分析 phase，跳过此前 phases 中已经决定过的灰区
4. 展示剩余灰区，由用户选择要讨论哪些
5. 对每个选中的 area 深入讨论，直到满意为止
6. 创建 `CONTEXT.md`，写入可指导研究和规划的决策

**输出：** `{phase_num}-CONTEXT.md`，其中的决策要足够明确，让下游 agents 无需再次询问用户即可行动
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/discuss-phase.md
@~/.claude/get-shit-done/workflows/discuss-phase-assumptions.md
@~/.claude/get-shit-done/workflows/discuss-phase-power.md
@~/.claude/get-shit-done/templates/context.md
</execution_context>

<runtime_note>
**Copilot (VS Code)：** 在该工作流调用 `AskUserQuestion` 的地方，使用 `vscode_askquestions`。两者等价，`vscode_askquestions` 是 VS Code Copilot 对同一交互提问 API 的实现。
</runtime_note>

<context>
Phase 编号：$ARGUMENTS（必填）

上下文文件会在工作流中通过 `init phase-op` 和 roadmap/state 工具调用进行解析。
</context>

<process>
**模式路由：**
```bash
DISCUSS_MODE=$(gsd-sdk query config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

如果 `DISCUSS_MODE` 为 `"assumptions"`：读取并端到端执行 `@~/.claude/get-shit-done/workflows/discuss-phase-assumptions.md`。

如果 `DISCUSS_MODE` 为 `"discuss"`（或未设置，或其他任意值）：读取并端到端执行 `@~/.claude/get-shit-done/workflows/discuss-phase.md`。

**强制要求：** 上面列出的 `execution_context` 文件本身就是指令。采取任何动作之前，先读取工作流文件。此命令文件中的 `objective` 和 `success_criteria` 只是摘要，完整的逐步流程、必需行为、配置检查和交互模式都在工作流文件里。不要根据摘要自行发挥。
</process>

<success_criteria>
- 已加载并应用既有上下文（不重复询问已决定的问题）
- 已通过智能分析识别灰区
- 用户已选择要讨论哪些 area
- 每个选中的 area 都已充分探索，直到满意为止
- 范围蔓延已被引导为延期想法
- `CONTEXT.md` 记录的是决策，而不是模糊愿景
- 用户清楚下一步
</success_criteria>
