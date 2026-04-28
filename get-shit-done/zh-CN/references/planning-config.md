<planning_config>

`.planning/` 目录行为的配置选项。

<config_schema>
```json
"planning": {
  "commit_docs": true,
  "search_gitignored": false
},
"git": {
  "branching_strategy": "none",
  "base_branch": null,
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}",
  "quick_branch_template": null
},
"manager": {
  "flags": {
    "discuss": "",
    "plan": "",
    "execute": ""
  }
}
```

| 选项 | 默认值 | 说明 |
|--------|---------|-------------|
| `commit_docs` | `true` | 是否将规划产物提交到 git |
| `search_gitignored` | `false` | 为广泛的 rg 搜索添加 `--no-ignore` |
| `git.branching_strategy` | `"none"` | Git 分支策略：`"none"`、`"phase"` 或 `"milestone"` |
| `git.base_branch` | `null`（auto-detect） | PR 和合并的目标分支（例如 `"master"`、`"develop"`）。为 `null` 时，会从 `git symbolic-ref refs/remotes/origin/HEAD` 自动检测，回退到 `"main"`。 |
| `git.phase_branch_template` | `"gsd/phase-{phase}-{slug}"` | phase 策略的分支模板 |
| `git.milestone_branch_template` | `"gsd/{milestone}-{slug}"` | milestone 策略的分支模板 |
| `git.quick_branch_template` | `null` | quick-task 运行的可选分支模板 |
| `workflow.use_worktrees` | `true` | 执行器 agent 是否在隔离的 git worktree 中运行。设为 `false` 可禁用 worktree，agent 将改为在主工作树上串行执行。适合单人开发或 worktree 合并有问题的情况。 |
| `workflow.subagent_timeout` | `300000` | 并行子 agent 任务的超时时间（毫秒，例如代码库映射）。大型代码库或较慢模型可增大。默认：300000（5 分钟）。 |
| `workflow.inline_plan_threshold` | `2` | 任务数不超过该值的计划将以内联方式执行（Pattern C），而不是启动子 agent。可避免小计划约 14K token 的启动开销。设为 `0` 可始终启动子 agent。 |
| `manager.flags.discuss` | `""` | 从 manager 分发时传给 `/gsd-discuss-phase` 的 flags（例如 `"--auto --analyze"`） |
| `manager.flags.plan` | `""` | 从 manager 分发时传给 plan 工作流的 flags |
| `manager.flags.execute` | `""` | 从 manager 分发时传给 execute 工作流的 flags |
| `response_language` | `null` | 所有阶段/子 agent 的面向用户问题和提示所用语言（例如 `"Portuguese"`、`"Japanese"`、`"Spanish"`）。设置后，所有新启动的 agent 都会附带使用该语言回复的指令。 |
</config_schema>

<commit_docs_behavior>

**当 `commit_docs: true`（默认）时：**
- 正常提交规划文件
- 将 SUMMARY.md、STATE.md、ROADMAP.md 纳入 git 跟踪
- 保留完整的规划决策历史

**当 `commit_docs: false` 时：**
- 跳过对 `.planning/` 文件执行的所有 `git add`/`git commit`
- 用户必须把 `.planning/` 加到 `.gitignore`
- 适用于：OSS 贡献、客户项目、保持规划私有

**使用 `gsd-sdk query`（推荐）：**

```bash
# 自动执行 commit_docs + gitignore 检查的提交：
gsd-sdk query commit "docs: update state" .planning/STATE.md

# 通过 state load 加载配置（返回 JSON）：
INIT=$(gsd-sdk query state.load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# JSON 输出中可用 commit_docs

# 或使用包含 commit_docs 的 init 命令：
INIT=$(gsd-sdk query init.execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# 所有 init 命令输出都包含 commit_docs
```

**自动检测：** 如果 `.planning/` 被 gitignore 忽略，则无论 config.json 如何设置，`commit_docs` 都会自动为 `false`。这样可避免用户在 `.gitignore` 中加入 `.planning/` 时出现 git 错误。

**通过 CLI 提交（自动处理检查）：**

```bash
gsd-sdk query commit "docs: update state" .planning/STATE.md
```

CLI 会在内部检查 `commit_docs` 配置和 gitignore 状态，无需手写条件判断。

</commit_docs_behavior>

<search_behavior>

**当 `search_gitignored: false`（默认）时：**
- 标准 rg 行为（遵守 `.gitignore`）
- 直接路径搜索可用：`rg "pattern" .planning/` 能找到文件
- 广泛搜索会跳过被 gitignore 忽略的内容：`rg "pattern"` 会跳过 `.planning/`

**当 `search_gitignored: true` 时：**
- 对应包含 `.planning/` 的广泛 rg 搜索时添加 `--no-ignore`
- 仅在搜索整个仓库并期望匹配 `.planning/` 时需要

**注意：** 大多数 GSD 操作使用直接文件读取或显式路径，因此无论 gitignore 状态如何都能工作。

</search_behavior>

<setup_uncommitted_mode>

使用未提交模式：

1. **设置配置：**
   ```json
   "planning": {
     "commit_docs": false,
     "search_gitignored": true
   }
   ```

2. **添加到 .gitignore：**
   ```
   .planning/
   ```

3. **已有已跟踪文件：** 如果 `.planning/` 之前已被跟踪：
   ```bash
   git rm -r --cached .planning/
   git commit -m "chore: stop tracking planning docs"
   ```

4. **分支合并：** 当 `branching_strategy: phase` 或 `milestone` 与 `commit_docs: false` 一起使用时，`complete-milestone` 工作流会在生成合并提交前自动从暂存区移除 `.planning/` 文件。

</setup_uncommitted_mode>

<branching_strategy_behavior>

**分支策略：**

| 策略 | 创建分支的时机 | 分支范围 | 合并点 |
|----------|---------------------|--------------|-------------|
| `none` | 从不创建 | N/A | N/A |
| `phase` | 在 `execute-phase` 开始时 | 单个 phase | phase 结束后由用户合并 |
| `milestone` | 在 milestone 的第一次 `execute-phase` 时 | 整个 milestone | 在 `complete-milestone` |

**当 `git.branching_strategy: "none"`（默认）时：**
- 所有工作都提交到当前分支
- 标准 GSD 行为

**当 `git.branching_strategy: "phase"` 时：**
- `execute-phase` 会在执行前创建/切换到一个分支
- 分支名来自 `phase_branch_template`（例如 `gsd/phase-03-authentication`）
- 该计划的所有提交都进入该分支
- phase 完成后由用户手动合并分支
- `complete-milestone` 会提供合并所有 phase 分支的选项

**当 `git.branching_strategy: "milestone"` 时：**
- milestone 的第一次 `execute-phase` 会创建 milestone 分支
- 分支名来自 `milestone_branch_template`（例如 `gsd/v1.0-mvp`）
- milestone 中所有 phase 都提交到同一分支
- `complete-milestone` 会提供将 milestone 分支合并到主分支的选项

**模板变量：**

| 变量 | 可用于 | 说明 |
|----------|--------------|-------------|
| `{phase}` | phase_branch_template | 补零后的 phase 编号（例如 `"03"`） |
| `{slug}` | Both | 小写短横线名称 |
| `{milestone}` | milestone_branch_template | milestone 版本（例如 `"v1.0"`） |

**检查配置：**

使用 `init execute-phase`，它会返回包含所有配置的 JSON：
```bash
INIT=$(gsd-sdk query init.execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# JSON 输出包含：branching_strategy、phase_branch_template、milestone_branch_template
```

或使用 `state load` 获取配置值：
```bash
INIT=$(gsd-sdk query state.load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# 从 JSON 中解析 branching_strategy、phase_branch_template、milestone_branch_template
```

**分支创建：**

```bash
# For phase strategy
if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  PHASE_SLUG=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$PHASE_BRANCH_TEMPLATE" | sed "s/{phase}/$PADDED_PHASE/g" | sed "s/{slug}/$PHASE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi

# For milestone strategy
if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  MILESTONE_SLUG=$(echo "$MILESTONE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed "s/{milestone}/$MILESTONE_VERSION/g" | sed "s/{slug}/$MILESTONE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi
```

**`complete-milestone` 时的合并选项：**

| 选项 | Git 命令 | 结果 |
|--------|-------------|--------|
| Squash merge（推荐） | `git merge --squash` | 每个分支生成一个整洁的提交 |
| 保留历史合并 | `git merge --no-ff` | 保留所有单独提交历史 |
| 不合并直接删除 | `git branch -D` | 丢弃分支工作 |
| 保留分支 | (none) | 之后手动处理 |

推荐使用 Squash merge，它能保持主分支历史整洁，同时在分支中保留完整开发历史（直到删除）。

**适用场景：**

| 策略 | 最适合 |
|----------|----------|
| `none` | 单人开发、简单项目 |
| `phase` | 按 phase 做代码评审、细粒度回滚、团队协作 |
| `milestone` | 发布分支、预发布环境、按版本建 PR |

</branching_strategy_behavior>

<complete_field_reference>

## 完整字段参考

从 `CONFIG_DEFAULTS`（core.cjs）和 `VALID_CONFIG_KEYS`（config.cjs）生成。

### 核心字段

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `model_profile` | string | `"balanced"` | `"quality"`, `"balanced"`, `"budget"`, `"inherit"` | 子 agent 的模型选择预设 |
| `mode` | string | `"interactive"` | `"interactive"`, `"yolo"` | 运行模式：`"interactive"` 显示关卡和确认；`"yolo"` 无提示自主运行 |
| `granularity` | string | (none) | `"coarse"`, `"standard"`, `"fine"` | phase 计划的规划深度（由已弃用的 `depth` 迁移而来） |
| `commit_docs` | boolean | `true` | `true`, `false` | 将 `.planning/` 产物提交到 git（若 `.planning/` 被 gitignore 忽略则自动变为 false） |
| `search_gitignored` | boolean | `false` | `true`, `false` | 通过 `--no-ignore` 在广泛 rg 搜索中包含被 gitignore 忽略的路径 |
| `phase_naming` | string | `"sequential"` | `"sequential"`, `"custom"` | phase 编号方式：自动递增或任意字符串 ID |
| `project_code` | string\|null | `null` | 任意短字符串 | phase 目录前缀（例如 `"CK"` 会生成 `CK-01-foundation`） |
| `response_language` | string\|null | `null` | 任意语言名称 | 面向用户提示的语言（例如 `"Portuguese"`、`"Japanese"`） |
| `context_window` | number | `200000` | `200000`, `1000000` | 上下文窗口大小；1M 上下文模型设为 `1000000` |
| `resolve_model_ids` | boolean\|string | `false` | `false`, `true`, `"omit"` | 将模型别名映射为完整 Claude ID；`"omit"` 返回空字符串 |
| `context` | string\|null | `null` | `"dev"`, `"research"`, `"review"` | 调整 agent 行为的执行上下文配置：`"dev"` 用于开发任务，`"research"` 用于调查/探索，`"review"` 用于代码评审工作流 |
| `review.models.<cli>` | string\|null | `null` | 任意模型 ID 字符串 | `/gsd-review` 的按 CLI 维度模型覆盖（例如 `review.models.gemini`）。为 null 时回退到 CLI 默认值。 |

### 工作流字段

通过 config.json 中的 `workflow.*` 命名空间设置（例如 `"workflow": { "research": true }`）。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `workflow.research` | boolean | `true` | `true`, `false` | 规划前运行 research agent |
| `workflow.plan_check` | boolean | `true` | `true`, `false` | 运行 plan-checker agent 验证计划。_别名：_ `plan_checker` 是 `CONFIG_DEFAULTS` 中的扁平键形式；`workflow.plan_check` 是规范的命名空间形式。 |
| `workflow.verifier` | boolean | `true` | `true`, `false` | 执行后运行 verifier agent |
| `workflow.nyquist_validation` | boolean | `true` | `true`, `false` | 启用受 Nyquist 启发的验证关卡 |
| `workflow.auto_prune_state` | boolean | `false` | `true`, `false` | phase 完成时自动清理旧的 STATE.md 条目（保留最近 3 个 phase） |
| `workflow.auto_advance` | boolean | `false` | `true`, `false` | 完成后自动推进到下一个 phase |
| `workflow.node_repair` | boolean | `true` | `true`, `false` | 尝试自动修复失败的计划节点 |
| `workflow.node_repair_budget` | number | `2` | 任意正整数 | 每个失败节点的最大修复重试次数 |
| `workflow.ai_integration_phase` | boolean | `true` | `true`, `false` | 在规划 AI 系统 phase 前运行 `/gsd-ai-integration-phase` |
| `workflow.ui_phase` | boolean | `true` | `true`, `false` | 为前端 phase 生成 UI-SPEC.md |
| `workflow.ui_safety_gate` | boolean | `true` | `true`, `false` | UI 变更需要安全关卡批准 |
| `workflow.text_mode` | boolean | `false` | `true`, `false` | 使用纯文本编号列表，而不是 AskUserQuestion 菜单 |
| `workflow.research_before_questions` | boolean | `false` | `true`, `false` | discuss 阶段先研究后提问 |
| `workflow.discuss_mode` | string | `"discuss"` | `"discuss"`, `"assumptions"` | discuss-phase 的默认模式：`"discuss"` 进行交互式提问；`"assumptions"` 分析代码库并提出假设 |
| `workflow.skip_discuss` | boolean | `false` | `true`, `false` | 完全跳过 discuss 阶段 |
| `workflow.use_worktrees` | boolean | `true` | `true`, `false` | 在隔离的 git worktree 中运行执行器 agent |
| `workflow.subagent_timeout` | number | `300000` | 任意正整数（ms） | 并行子 agent 任务超时时间（默认：5 分钟） |
| `workflow.inline_plan_threshold` | number | `2` | `0`–`10` | 任务数 ≤N 的计划以内联方式执行，而不是启动子 agent |
| `workflow.code_review` | boolean | `true` | `true`, `false` | 在 ship 工作流中启用内置代码评审步骤 |
| `workflow.code_review_depth` | string | `"standard"` | `"light"`, `"standard"`, `"deep"` | ship 工作流中代码评审分析的深度级别 |
| `workflow._auto_chain_active` | boolean | `false` | `true`, `false` | 内部字段：跟踪自动链式执行是否启用 |
| `workflow.security_enforcement` | boolean | `true` | `true`, `false` | 通过 `/gsd-secure-phase` 启用基于威胁模型的安全验证。为 `false` 时完全跳过安全检查 |
| `workflow.security_asvs_level` | number | `1` | `1`, `2`, `3` | OWASP ASVS 验证级别。Level 1 = opportunistic，Level 2 = standard，Level 3 = comprehensive |
| `workflow.security_block_on` | string | `"high"` | `"high"`, `"medium"`, `"low"` | 会阻止 phase 推进的最低严重级别 |

### Git 字段

通过 `git.*` 命名空间设置（例如 `"git": { "branching_strategy": "phase" }`）。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `git.branching_strategy` | string | `"none"` | `"none"`, `"phase"`, `"milestone"` | 用于隔离 phase/milestone 的 Git 分支策略 |
| `git.base_branch` | string\|null | `null`（auto-detect） | 任意分支名 | PR 和合并的目标分支；为 `null` 时从 `origin/HEAD` 自动检测 |
| `git.phase_branch_template` | string | `"gsd/phase-{phase}-{slug}"` | 包含 `{phase}`、`{slug}` 的模板 | `phase` 策略的分支命名模板 |
| `git.milestone_branch_template` | string | `"gsd/{milestone}-{slug}"` | 包含 `{milestone}`、`{slug}` 的模板 | `milestone` 策略的分支命名模板 |
| `git.quick_branch_template` | string\|null | `null` | 包含 `{slug}` 的模板 | quick-task 运行的可选分支模板 |

### 搜索与 API 字段

这些字段用于切换外部搜索集成。创建项目时如果存在 API key 会自动检测。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `brave_search` | boolean | `false` | `true`, `false` | 为 research agent 启用 Brave web search（需要 `BRAVE_API_KEY`） |
| `firecrawl` | boolean | `false` | `true`, `false` | 启用 Firecrawl 页面抓取（需要 `FIRECRAWL_API_KEY`） |
| `exa_search` | boolean | `false` | `true`, `false` | 启用 Exa 语义搜索（需要 `EXA_API_KEY`） |

### 功能字段

通过 `features.*` 命名空间设置（例如 `"features": { "thinking_partner": true }`）。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `features.thinking_partner` | boolean | `false` | `true`, `false` | 在工作流决策点启用条件式扩展思考（由 discuss-phase 和 plan-phase 用于架构权衡分析） |
| `features.global_learnings` | boolean | `false` | `true`, `false` | 启用将 `~/.gsd/learnings/` 中的全局经验注入 agent prompt |

### Hook 字段

通过 `hooks.*` 命名空间设置（例如 `"hooks": { "context_warnings": true }`）。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `hooks.context_warnings` | boolean | `true` | `true`, `false` | 超出上下文预算时显示警告 |

### Learnings 字段

通过 `learnings.*` 命名空间设置（例如 `"learnings": { "max_inject": 5 }`）。与 `features.global_learnings` 一起使用。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `learnings.max_inject` | number | `10` | Any positive integer | 每个会话中可注入到 agent prompt 的全局经验条目最大数量 |

### Intel 字段

通过 `intel.*` 命名空间设置（例如 `"intel": { "enabled": true }`）。控制 `/gsd-intel` 使用的可查询代码库情报系统。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `intel.enabled` | boolean | `false` | `true`, `false` | 启用可查询代码库情报系统。为 `true` 时，`/gsd-intel` 命令会在 `.planning/intel/` 中构建并查询 JSON 索引。 |

### Manager 字段

通过 `manager.*` 命名空间设置（例如 `"manager": { "flags": { "discuss": "--auto" } }`）。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `manager.flags.discuss` | string | `""` | 任意 CLI flags 字符串 | 从 manager 传给 `/gsd-discuss-phase` 的 flags（例如 `"--auto --analyze"`） |
| `manager.flags.plan` | string | `""` | 任意 CLI flags 字符串 | 传给 plan 工作流的 flags |
| `manager.flags.execute` | string | `""` | 任意 CLI flags 字符串 | 传给 execute 工作流的 flags |

### 高级字段

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `parallelization` | boolean\|object | `true` | `true`, `false`, `{ "enabled": true }` | 启用并行 wave 执行；对象形式允许附加子键 |
| `model_overrides` | object\|null | `null` | `{ "<agent-type>": "<model-id>" }` | 按 agent 类型覆盖模型选择 |
| `agent_skills` | object | `{}` | `{ "<agent-type>": "<skill-set>" }` | 为特定 agent 类型分配 skill set |
| `sub_repos` | array | `[]` | 相对路径字符串数组 | 具有独立 `.git` 仓库的子目录（自动检测） |

### Planning 字段

这些字段可设置在顶层，也可嵌套在 `planning.*` 下（例如 `"planning": { "commit_docs": false }`）。两种形式等价；若同时存在，顶层优先。

| 键 | 类型 | 默认值 | 允许值 | 说明 |
|-----|------|---------|----------------|-------------|
| `planning.commit_docs` | boolean | `true` | `true`, `false` | 顶层 `commit_docs` 的别名 |
| `planning.search_gitignored` | boolean | `false` | `true`, `false` | 顶层 `search_gitignored` 的别名 |

---

## 字段交互

多个配置字段会相互影响，或触发特殊行为：

1. **`commit_docs` 自动检测** -- 当 config.json 中未显式设置该值且 `.planning/` 位于 `.gitignore` 中时，`commit_docs` 会自动解析为 `false`。如果在配置中显式设为 `true` 或 `false`，则始终覆盖自动检测。

2. **`branching_strategy` 控制分支模板** -- `phase_branch_template` 和 `milestone_branch_template` 仅在 `branching_strategy` 分别设为 `"phase"` 或 `"milestone"` 时使用。若 `branching_strategy` 为 `"none"`，所有模板字段都会被忽略。

3. **`context_window` 阈值触发** -- 当 `context_window >= 500000` 时，工作流会启用自适应上下文增强：完整读取先前 phase 的 SUMMARY 正文、在 plan-phase 中注入跨 phase 上下文，并对 anti-pattern 参考采用更深读取。低于 500000 时，仅读取 frontmatter 和摘要。

4. **`parallelization` 多态形式** -- 同时接受简单布尔值和带 `enabled` 字段的对象。`loadConfig()` 会将任一形式标准化为布尔值。`{ "enabled": true }` 等价于 `true`。

5. **搜索 API key 和 flags** -- `brave_search`、`firecrawl`、`exa_search` 会在项目创建时检测到对应 API key（环境变量或 `~/.gsd/<name>_api_key` 文件）后自动设为 `true`。如果没有 API key，仅把它们设为 `true` 不会生效。

6. **`planning.*` 与顶层等价** -- `planning.commit_docs` 与 `commit_docs` 等价；`planning.search_gitignored` 与 `search_gitignored` 等价。若两者都设置，顶层值优先。

7. **`depth` 到 `granularity` 的迁移** -- 已弃用的 `depth` 键（`quick`/`standard`/`comprehensive`）会在加载配置时自动迁移为 `granularity`（`coarse`/`standard`/`fine`），并持久化回磁盘。

8. **`sub_repos` 自动同步** -- 每次加载配置时，GSD 都会扫描带 `.git` 的子目录，并在文件系统变化时更新 `sub_repos` 数组。旧的 `multiRepo: true` 会自动迁移为检测得到的 `sub_repos` 数组。

---

## 配置示例

### 最小配置 -- 单人开发者

```json
{
  "model_profile": "balanced",
  "commit_docs": true,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "use_worktrees": false
  }
}
```

### 团队项目 -- 使用分支

```json
{
  "model_profile": "quality",
  "commit_docs": true,
  "project_code": "APP",
  "git": {
    "branching_strategy": "phase",
    "base_branch": "develop",
    "phase_branch_template": "gsd/phase-{phase}-{slug}"
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "use_worktrees": true,
    "discuss_mode": "discuss"
  },
  "manager": {
    "flags": {
      "discuss": "",
      "plan": "",
      "execute": ""
    }
  },
  "response_language": "English"
}
```

### 大型代码库 -- 1M 上下文与扩展超时

```json
{
  "model_profile": "quality",
  "context_window": 1000000,
  "commit_docs": true,
  "project_code": "MEGA",
  "phase_naming": "sequential",
  "git": {
    "branching_strategy": "milestone",
    "milestone_branch_template": "gsd/{milestone}-{slug}"
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "subagent_timeout": 600000,
    "use_worktrees": true,
    "node_repair": true,
    "node_repair_budget": 3,
    "auto_advance": true
  },
  "brave_search": true,
  "hooks": {
    "context_warnings": true
  }
}
```

</complete_field_reference>

</planning_config>
