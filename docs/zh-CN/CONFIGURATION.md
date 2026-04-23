# GSD 配置参考

> 完整配置 schema、工作流开关、模型 profile 和 git 分支选项。功能上下文请参阅 [FEATURES.md](FEATURES.md)。

---

## 配置文件

GSD 将项目设置存放在 `.planning/config.json` 中。该文件在 `/gsd-new-project` 期间创建，并可通过 `/gsd-settings` 更新。

### 完整 Schema

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "model_overrides": {},
  "planning": {
    "commit_docs": true,
    "search_gitignored": false,
    "sub_repos": []
  },
  "context": null,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "node_repair": true,
    "node_repair_budget": 2,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "tdd_mode": false,
    "text_mode": false,
    "use_worktrees": true,
    "code_review": true,
    "code_review_depth": "standard",
    "plan_bounce": false,
    "plan_bounce_script": null,
    "plan_bounce_passes": 2,
    "plan_chunked": false,
    "code_review_command": null,
    "cross_ai_execution": false,
    "cross_ai_command": null,
    "cross_ai_timeout": 300,
    "security_enforcement": true,
    "security_asvs_level": 1,
    "security_block_on": "high"
  },
  "hooks": {
    "context_warnings": true,
    "workflow_guard": false
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "quick_branch_template": null
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "project_code": null,
  "agent_skills": {},
  "response_language": null,
  "features": {
    "thinking_partner": false,
    "global_learnings": false
  },
  "learnings": {
    "max_inject": 10
  },
  "intel": {
    "enabled": false
  },
  "claude_md_path": "./CLAUDE.md"
}
```

---

## 核心设置

| 设置 | 类型 | 选项 | 默认值 | 说明 |
|---------|------|---------|---------|-------------|
| `mode` | 枚举 | `interactive`, `yolo` | `interactive` | `yolo` 会自动批准决策；`interactive` 会在每一步确认 |
| `granularity` | 枚举 | `coarse`, `standard`, `fine` | `standard` | 控制阶段数量：`coarse`(3-5)、`standard`(5-8)、`fine`(8-12) |
| `model_profile` | 枚举 | `quality`, `balanced`, `budget`, `inherit` | `balanced` | 每个代理使用的模型等级（见 [Model Profiles](#model-profiles)） |
| `project_code` | 字符串 | 任意短字符串 | (无) | 阶段目录名前缀（例如 `"ABC"` 会生成 `ABC-01-setup/`）。v1.31 引入 |
| `response_language` | 字符串 | 语言代码 | (无) | 代理回复所用语言（例如 `"pt"`、`"ko"`、`"ja"`）。会传播给所有派生代理，以保证跨阶段语言一致性。v1.32 引入 |
| `context_profile` | 字符串 | `dev`, `research`, `review` | (无) | 预设执行上下文，为当前工作类型应用一组预配置的模式、模型和工作流设置。v1.34 引入 |
| `claude_md_path` | 字符串 | 任意文件路径 | `./CLAUDE.md` | 生成的 CLAUDE.md 文件输出路径。适合 monorepo 或需要非根目录 CLAUDE.md 的项目。默认是项目根目录下的 `./CLAUDE.md`。v1.36 引入 |
| `claude_md_assembly.mode` | 枚举 | `embed`, `link` | `embed` | 控制受管理部分如何写入 CLAUDE.md。`embed`（默认）会把内容内联到 GSD 标记之间。`link` 会改为写入 `@.planning/<source-path>`，Claude Code 会在运行时展开引用，通常可让 CLAUDE.md 体积减少约 65%。`link` 只适用于有真实源文件的部分；`workflow` 和回退部分始终内联。可按块覆盖：`claude_md_assembly.blocks.<section>`（例如 `claude_md_assembly.blocks.architecture: link`）。v1.38 引入 |
| `context` | 字符串 | 任意文本 | (无) | 注入到每个代理提示中的自定义上下文字符串。用于提供所有代理都应知晓的项目级指导（例如编码约定、团队实践）。 |
| `phase_naming` | 字符串 | 任意字符串 | (无) | 阶段目录名自定义前缀。设置后会覆盖自动生成的 phase slug（例如 `"feature"` 会生成 `feature-01-setup/`，而不是路线图派生的 slug）。 |
| `brave_search` | 布尔值 | `true`/`false` | 自动检测 | 覆盖 Brave Search API 可用性的自动检测。未设置时，GSD 会检查 `BRAVE_API_KEY` 环境变量或 `~/.gsd/brave_api_key` 文件。 |
| `firecrawl` | 布尔值 | `true`/`false` | 自动检测 | 覆盖 Firecrawl API 可用性的自动检测。未设置时，GSD 会检查 `FIRECRAWL_API_KEY` 环境变量或 `~/.gsd/firecrawl_api_key` 文件。 |
| `exa_search` | 布尔值 | `true`/`false` | 自动检测 | 覆盖 Exa Search API 可用性的自动检测。未设置时，GSD 会检查 `EXA_API_KEY` 环境变量或 `~/.gsd/exa_api_key` 文件。 |
| `search_gitignored` | 布尔值 | `true`/`false` | `false` | `planning.search_gitignored` 的旧顶层别名。建议使用命名空间形式；保留该别名仅用于向后兼容。 |

> **注意：** `granularity` 在 v1.22.3 中由 `depth` 更名而来。现有配置会自动迁移。

---

## 工作流开关

所有工作流开关都遵循 **缺省即启用** 的模式。如果配置中缺少某个键，它默认就是 `true`。

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `workflow.research` | 布尔值 | `true` | 每个阶段规划前进行领域研究 |
| `workflow.plan_check` | 布尔值 | `true` | 计划验证循环（最多 3 次迭代） |
| `workflow.verifier` | 布尔值 | `true` | 执行后按阶段目标进行验证 |
| `workflow.auto_advance` | 布尔值 | `false` | 自动串联 discuss → plan → execute，不停下来 |
| `workflow.nyquist_validation` | 布尔值 | `true` | 在 plan-phase 研究期间映射测试覆盖率 |
| `workflow.ui_phase` | 布尔值 | `true` | 为前端阶段生成 UI 设计契约 |
| `workflow.ui_safety_gate` | 布尔值 | `true` | 在 plan-phase 中提示为前端阶段运行 `/gsd-ui-phase` |
| `workflow.node_repair` | 布尔值 | `true` | 验证失败时自动修复任务 |
| `workflow.node_repair_budget` | 数值 | `2` | 每个失败任务最多修复次数 |
| `workflow.research_before_questions` | 布尔值 | `false` | 先研究，再提问，而不是反过来 |
| `workflow.discuss_mode` | 字符串 | `'discuss'` | 控制 `/gsd-discuss-phase` 如何收集上下文。`'discuss'`（默认）逐个提问；`'assumptions'` 会先读代码库，生成带置信度的结构化假设，只让你修正错误部分。v1.28 引入 |
| `workflow.skip_discuss` | 布尔值 | `false` | 当为 `true` 时，`/gsd-autonomous` 会完全跳过 discuss-phase，只根据 ROADMAP 阶段目标写最小化的 CONTEXT.md。适合开发者偏好已在 PROJECT.md/REQUIREMENTS.md 中完整表达的项目。v1.28 引入 |
| `workflow.text_mode` | 布尔值 | `false` | 用纯文本编号列表替代 AskUserQuestion 的 TUI 菜单。远程 Claude Code 会话（`/rc` 模式）需要这个，因为 TUI 不会渲染。也可以在 discuss-phase 上用 `--text` 按会话设置。v1.28 引入 |
| `workflow.use_worktrees` | 布尔值 | `true` | 为并行执行启用 git worktree 隔离；设为 `false` 可关闭。适合偏好顺序执行或环境不支持 worktree 的用户。v1.31 引入 |
| `workflow.code_review` | 布尔值 | `true` | 启用 `/gsd-code-review` 和 `/gsd-code-review-fix` 命令；关闭后命令会以配置门禁消息退出。v1.34 引入 |
| `workflow.code_review_depth` | 字符串 | `standard` | `/gsd-code-review` 的默认审查深度：`quick`（仅模式匹配）、`standard`（逐文件分析）、`deep`（跨文件+导入图）。可在运行时通过 `--depth=` 覆盖。v1.34 引入 |
| `workflow.plan_bounce` | 布尔值 | `false` | 对生成的计划运行外部验证脚本。启用后，plan-phase 编排器会把每个 PLAN.md 传给 `plan_bounce_script` 指定的脚本，并在返回非 0 时阻止继续。v1.36 引入 |
| `workflow.plan_bounce_script` | 字符串 | (无) | 计划 bounce 验证所调用的外部脚本路径。它会把 PLAN.md 路径作为第一个参数接收。只有在 `plan_bounce` 为 `true` 时才需要。v1.36 引入 |
| `workflow.plan_bounce_passes` | 数值 | `2` | 顺序 bounce 的轮数。每一轮会把上一轮输出回传给验证器。更高轮数会提高严格度，但也会增加延迟。v1.36 引入 |
| `workflow.plan_chunked` | 布尔值 | `false` | 启用分块规划模式。为 `true`（或在 `/gsd-plan-phase` 传入 `--chunked`）时，编排器会把单个长生命周期 planner Task 拆成一个短大纲 Task，再接 N 个短的逐计划 Task（每个约 3-5 分钟）。每个计划都会单独提交，增强崩溃恢复能力。若 Task 卡住且终端被强制结束，重新以 `--chunked` 运行会从最后完成的计划继续。对 Windows 特别有用，因为长生命周期 Task 可能在 stdio 上挂起。v1.38 引入 |
| `workflow.code_review_command` | 字符串 | (无) | 用于 `/gsd-ship` 的外部代码审查集成 Shell 命令。通过 stdin 接收变更文件路径。非 0 退出会阻止 ship 工作流。v1.36 引入 |
| `workflow.tdd_mode` | 布尔值 | `false` | 将 TDD 流水线作为一等执行模式。启用后，规划器会积极把 `type: tdd` 应用于适合的任务（业务逻辑、API、校验、算法），执行器会强制 RED/GREEN/REFACTOR 门禁序列。阶段结束时的协作评审检查点会验证门禁合规。v1.36 引入 |
| `workflow.cross_ai_execution` | 布尔值 | `false` | 将阶段执行委托给外部 AI CLI，而不是启动本地 executor 代理。适合针对特定阶段利用不同模型的优势。v1.36 引入 |
| `workflow.cross_ai_command` | 字符串 | (无) | 跨 AI 执行的 Shell 命令模板。通过 stdin 接收阶段提示词，必须输出与 `SUMMARY.md` 兼容的内容。只有在 `cross_ai_execution` 为 `true` 时才需要。v1.36 引入 |
| `workflow.cross_ai_timeout` | 数值 | `300` | 跨 AI 执行命令的超时时间（秒），防止外部进程失控。v1.36 引入 |
| `workflow.ai_integration_phase` | 布尔值 | `true` | 启用 `/gsd-ai-integration-phase` 命令；关闭后命令会以配置门禁消息退出 |
| `workflow.auto_prune_state` | 布尔值 | `false` | 为 `true` 时，在阶段边界自动清理 STATE.md 中的陈旧条目，而不是询问 |
| `workflow.pattern_mapper` | 布尔值 | `true` | 在研究和规划之间运行 `gsd-pattern-mapper` 代理，把新文件映射到现有代码库类比 |
| `workflow.subagent_timeout` | 数值 | `600` | 单个子代理调用的超时时间（秒）。长时间研究或执行阶段可适当提高 |
| `workflow.inline_plan_threshold` | 数值 | `3` | 一个阶段中任务数的上限；超过后，规划器会生成独立的 PLAN.md，而不是把任务内联到提示词里 |

### 推荐预设

| 场景 | mode | granularity | profile | research | plan_check | verifier |
|----------|------|-------------|---------|----------|------------|----------|
| 原型开发 | `yolo` | `coarse` | `budget` | `false` | `false` | `false` |
| 日常开发 | `interactive` | `standard` | `balanced` | `true` | `true` | `true` |
| 生产发布 | `interactive` | `fine` | `quality` | `true` | `true` | `true` |

---

## 并行化

| 设置 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `parallelization.enabled` | 布尔值 | `true` | 启用并行代理执行 |
| `parallelization.plan_level` | 布尔值 | `true` | 允许计划级并行 |
| `parallelization.task_level` | 布尔值 | `false` | 允许任务级并行 |
| `parallelization.skip_checkpoints` | 布尔值 | `true` | 并行执行时跳过某些检查点 |
| `parallelization.max_concurrent_agents` | 数值 | `3` | 同时运行的代理上限 |
| `parallelization.min_plans_for_parallel` | 数值 | `2` | 触发并行的最少计划数 |

## Git

| 设置 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `git.branching_strategy` | 枚举 | `none` | `none`、`phase` 或 `milestone` |
| `git.phase_branch_template` | 字符串 | `gsd/phase-{phase}-{slug}` | 阶段分支命名模板 |
| `git.milestone_branch_template` | 字符串 | `gsd/{milestone}-{slug}` | 里程碑分支命名模板 |
| `git.quick_branch_template` | 字符串 | (无) | 快速任务分支模板 |

## 门禁

| 设置 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `gates.confirm_project` | 布尔值 | `true` | 新项目确认门禁 |
| `gates.confirm_phases` | 布尔值 | `true` | 阶段确认门禁 |
| `gates.confirm_roadmap` | 布尔值 | `true` | 路线图确认门禁 |
| `gates.confirm_breakdown` | 布尔值 | `true` | 任务拆分确认门禁 |
| `gates.confirm_plan` | 布尔值 | `true` | 计划确认门禁 |
| `gates.execute_next_plan` | 布尔值 | `true` | 是否自动执行下一计划 |
| `gates.issues_review` | 布尔值 | `true` | 问题审阅门禁 |
| `gates.confirm_transition` | 布尔值 | `true` | 阶段/里程碑转换确认门禁 |

## 安全

| 设置 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `safety.always_confirm_destructive` | 布尔值 | `true` | 破坏性操作总要确认 |
| `safety.always_confirm_external_services` | 布尔值 | `true` | 调用外部服务总要确认 |

## 功能

| 设置 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `features.thinking_partner` | 布尔值 | `false` | 启用 thinking partner 功能 |
| `features.global_learnings` | 布尔值 | `false` | 启用全局学习存储 |

## 语言和路径

| 设置 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `response_language` | 字符串 | (无) | 代理回复语言代码 |
| `claude_md_path` | 字符串 | `./CLAUDE.md` | 生成的 CLAUDE.md 输出路径 |

## 使用建议

- 想更快：把 `mode` 设为 `yolo`
- 想更稳：保留 `interactive` + `standard`
- 前端项目：保留 `workflow.ui_phase: true`
- 测试驱动任务：打开 `workflow.tdd_mode`
- 不想分支：把 `git.branching_strategy` 设为 `none`
