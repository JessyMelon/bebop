<purpose>
分析用户提供的自由文本，并将其路由到最合适的 GSD 命令。这是一个分发器，不会自行执行工作。将用户意图匹配到最佳命令，确认路由结果，然后交接出去。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="validate">
**检查是否有输入。**


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入所选编号。这对无法使用 `AskUserQuestion` 的非-Claude runtime（OpenAI Codex、Gemini CLI 等）是必需的。
如果 `$ARGUMENTS` 为空，通过 AskUserQuestion 询问：

```
What would you like to do? Describe the task, bug, or idea and I'll route it to the right GSD command.
```

继续前等待回复。
</step>

<step name="check_project">
**检查项目是否存在。**

```bash
INIT=$(gsd-sdk query state.load 2>/dev/null)
```

记录 `.planning/` 是否存在，因为有些路由需要它，有些则不需要。
</step>

<step name="route">
**将意图匹配到命令。**

根据以下路由规则评估 `$ARGUMENTS`。应用**第一个匹配**的规则：

| If the text describes... | Route to | Why |
|--------------------------|----------|-----|
| Starting a new project, "set up", "initialize" | `/gsd-new-project` | Needs full project initialization |
| Mapping or analyzing an existing codebase | `/gsd-map-codebase` | Codebase discovery |
| A bug, error, crash, failure, or something broken | `/gsd-debug` | Needs systematic investigation |
| Spiking, "test if", "will this work", "experiment", "prove this out", validate feasibility | `/gsd-spike` | Throwaway experiment to validate feasibility |
| Sketching, "mockup", "what would this look like", "prototype the UI", "design this", explore visual direction | `/gsd-sketch` | Throwaway HTML mockups to explore design |
| Wrapping up spikes, "package the spikes", "consolidate spike findings" | `/gsd-spike-wrap-up` | Package spike findings into reusable skill |
| Wrapping up sketches, "package the designs", "consolidate sketch findings" | `/gsd-sketch-wrap-up` | Package sketch findings into reusable skill |
| Exploring, researching, comparing, or "how does X work" | `/gsd-research-phase` | Domain research before planning |
| Discussing vision, "how should X look", brainstorming | `/gsd-discuss-phase` | Needs context gathering |
| A complex task: refactoring, migration, multi-file architecture, system redesign | `/gsd-add-phase` | Needs a full phase with plan/build cycle |
| Planning a specific phase or "plan phase N" | `/gsd-plan-phase` | Direct planning request |
| Executing a phase or "build phase N", "run phase N" | `/gsd-execute-phase` | Direct execution request |
| Running all remaining phases automatically | `/gsd-autonomous` | Full autonomous execution |
| A review or quality concern about existing work | `/gsd-verify-work` | Needs verification |
| Checking progress, status, "where am I" | `/gsd-progress` | Status check |
| Resuming work, "pick up where I left off" | `/gsd-resume-work` | Session restoration |
| A note, idea, or "remember to..." | `/gsd-add-todo` | Capture for later |
| Adding tests, "write tests", "test coverage" | `/gsd-add-tests` | Test generation |
| Completing a milestone, shipping, releasing | `/gsd-complete-milestone` | Milestone lifecycle |
| A specific, actionable, small task (add feature, fix typo, update config) | `/gsd-quick` | Self-contained, single executor |

**需要 `.planning/` 目录：** 除 `/gsd-new-project`、`/gsd-map-codebase`、`/gsd-spike`、`/gsd-sketch`、`/gsd-help` 和 `/gsd-join-discord` 之外的所有路由。如果项目不存在且该路由需要它，先建议使用 `/gsd-new-project`。

**歧义处理：** 如果文本有合理可能匹配多个路由，通过 AskUserQuestion 向用户提供最靠前的 2-3 个选项。例如：

```
"Refactor the authentication system" could be:
1. /gsd-add-phase — Full planning cycle (recommended for multi-file refactors)
2. /gsd-quick — Quick execution (if scope is small and clear)

Which approach fits better?
```
</step>

<step name="display">
**展示路由决策。**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ROUTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Input:** {first 80 chars of $ARGUMENTS}
**Routing to:** {chosen command}
**Reason:** {one-line explanation}
```
</step>

<step name="dispatch">
**调用选中的命令。**

运行选中的 `/gsd-*` 命令，并将 `$ARGUMENTS` 作为参数传入。

如果所选命令需要 phase 编号，而文本中未提供，则从上下文中提取，或通过 AskUserQuestion 询问。

调用命令后停止。后续所有处理都由被分发的命令负责。
</step>

</process>

<success_criteria>
- [ ] 输入已验证（非空）
- [ ] 意图已准确匹配到一个 GSD 命令
- [ ] 如有需要，已通过用户提问消除歧义
- [ ] 对需要项目存在的路由，已检查项目是否存在
- [ ] 分发前已展示路由决策
- [ ] 已使用合适参数调用命令
- [ ] 未直接执行任何工作，只负责分发
</success_criteria>
