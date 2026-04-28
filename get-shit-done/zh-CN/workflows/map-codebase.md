<purpose>
编排并行 codebase mapper agents 来分析代码库，并在 `.planning/codebase/` 中生成结构化文档。

每个 agent 都拥有全新上下文，专注探索一个特定领域，并且**直接写文档**。orchestrator 只接收确认信息和行数，然后写入摘要。

输出：`.planning/codebase/` 目录，其中包含 7 份关于当前代码库状态的结构化文档。
</purpose>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-codebase-mapper — 映射项目结构和依赖
</available_agent_types>

<philosophy>
**为什么使用专用 mapper agents：**
- 每个领域使用全新上下文（避免 token 污染）
- Agents 直接写文档（无需把上下文再传回 orchestrator）
- Orchestrator 只总结已创建的内容（最小化上下文占用）
- 执行更快（agents 同时运行）

**文档质量优先于长度：**
提供足够有用的参考细节。优先写实用示例（尤其是代码模式），不要为了短而短。

**始终包含文件路径：**
这些文档是 Claude 在 plan/execute 时的参考材料。始终包含实际文件路径，并用反引号包裹：`src/services/user.ts`。
</philosophy>

<process>

<step name="init_context" priority="first">
加载 codebase mapping 上下文：

```bash
INIT=$(gsd-sdk query init.map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_MAPPER=$(gsd-sdk query agent-skills gsd-codebase-mapper 2>/dev/null)
```

从 init JSON 提取：`mapper_model`、`commit_docs`、`codebase_dir`、`existing_maps`、`has_maps`、`codebase_dir_exists`、`subagent_timeout`、`date`。
</step>

<step name="check_existing">
使用 init 上下文中的 `has_maps` 检查 `.planning/codebase/` 是否已存在。

如果 `codebase_dir_exists` 为 true：
```bash
ls -la .planning/codebase/
```

**如果已存在：**

```
.planning/codebase/ already exists with these documents:
[List files found]

What's next?
1. Refresh - Delete existing and remap codebase
2. Update - Keep existing, only update specific documents
3. Skip - Use existing codebase map as-is
```

等待用户回复。

如果是 "Refresh"：删除 `.planning/codebase/`，然后继续到 create_structure
如果是 "Update"：询问要更新哪些文档，然后继续到 spawn_agents（带过滤）
如果是 "Skip"：退出 workflow

**如果不存在：**
继续到 create_structure。
</step>

<step name="create_structure">
创建 `.planning/codebase/` 目录：

```bash
mkdir -p .planning/codebase
```

**预期输出文件：**
- STACK.md（由 tech mapper 生成）
- INTEGRATIONS.md（由 tech mapper 生成）
- ARCHITECTURE.md（由 arch mapper 生成）
- STRUCTURE.md（由 arch mapper 生成）
- CONVENTIONS.md（由 quality mapper 生成）
- TESTING.md（由 quality mapper 生成）
- CONCERNS.md（由 concerns mapper 生成）

继续到 spawn_agents。
</step>

<step name="detect_runtime_capabilities">
在启动 agents 之前，检测当前 runtime 是否支持用于 subagent 委派的 `Task` tool。

**检测方式：**检查你是否拥有 `Task` tool（根据 runtime 不同，可能是大写 `Task`，也可能是小写 `task`）。如果你**没有** `Task`/`task` tool（或只有像 `browser_subagent` 这种用于网页浏览、**不**适用于代码分析的工具）：

→ **跳过 `spawn_agents` 和 `collect_confirmations`**，直接进入 `sequential_mapping`。

**CRITICAL:** 绝不要用 `browser_subagent` 或 `Explore` 代替 `Task`。`browser_subagent` 仅用于网页交互，拿它做代码分析会失败。如果 `Task` 不可用，就在当前上下文中顺序执行 mapping。
</step>

<step name="spawn_agents" condition="Task tool is available">
并行启动 4 个 `gsd-codebase-mapper` agents。

使用 Task tool，设置 `subagent_type="gsd-codebase-mapper"`、`model="{mapper_model}"` 和 `run_in_background=true` 以并行执行。

**CRITICAL:** 使用专用的 `gsd-codebase-mapper` agent，**不要**使用 `Explore` 或 `browser_subagent`。mapper agent 会直接写文档。

**Agent 1: Tech Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase tech stack",
  prompt="Focus: tech
Today's date: {date}

Analyze this codebase for technology stack and external integrations.

Write these documents to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**Agent 2: Architecture Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase architecture",
  prompt="Focus: arch
Today's date: {date}

Analyze this codebase architecture and directory structure.

Write these documents to .planning/codebase/:
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**Agent 3: Quality Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase conventions",
  prompt="Focus: quality
Today's date: {date}

Analyze this codebase for coding conventions and testing patterns.

Write these documents to .planning/codebase/:
- CONVENTIONS.md - Code style, naming, patterns, error handling
- TESTING.md - Framework, structure, mocking, coverage

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**Agent 4: Concerns Focus**

```
Task(
  subagent_type="gsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase concerns",
  prompt="Focus: concerns
Today's date: {date}

Analyze this codebase for technical debt, known issues, and areas of concern.

Write this document to .planning/codebase/:
- CONCERNS.md - Tech debt, bugs, security, performance, fragile areas

IMPORTANT: Use {date} for all [YYYY-MM-DD] date placeholders in documents.

Explore thoroughly. Write document directly using template. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

继续到 collect_confirmations。
</step>

<step name="collect_confirmations">
使用 TaskOutput tool 等待 4 个 agents 全部完成。

**对上面 Agent tool 调用返回的每个 agent task_id：**
```
TaskOutput tool:
  task_id: "{task_id from Agent result}"
  block: true
  timeout: {subagent_timeout from init context, default 300000}
```

> 超时时间可通过 `.planning/config.json` 中的 `workflow.subagent_timeout`（毫秒）配置。默认：300000（5 分钟）。对于大型代码库或较慢的 model，可适当增大。

并行调用所有 4 个 agent 的 TaskOutput（单条消息中发 4 个 TaskOutput 调用）。

当所有 TaskOutput 返回后，读取每个 agent 的输出文件，收集确认信息。

**来自每个 agent 的预期确认格式：**
```
## Mapping Complete

**Focus:** {focus}
**Documents written:**
- `.planning/codebase/{DOC1}.md` ({N} lines)
- `.planning/codebase/{DOC2}.md` ({N} lines)

Ready for orchestrator summary.
```

**你会收到什么：**只有文件路径和行数，**不会**收到文档内容。

如果任一 agent 失败，记录该失败，并继续处理成功生成的文档。

继续到 verify_output。
</step>

<step name="sequential_mapping" condition="Task tool is NOT available (e.g. Antigravity, Gemini CLI, Codex)">
当 `Task` tool 不可用时，在当前上下文中顺序执行 codebase mapping。此步骤替代 `spawn_agents` 和 `collect_confirmations`。

**IMPORTANT:** 不要使用 `browser_subagent`、`Explore` 或任何基于浏览器的工具。只使用文件系统工具（Read、Bash、Write、Grep、Glob、list_dir、view_file、grep_search，或当前 runtime 中的等价工具）。

**IMPORTANT:** 文档中的所有 `[YYYY-MM-DD]` 日期占位符都必须使用 init 上下文中的 `{date}`。**绝不要**自行猜测日期。

按顺序执行全部 4 轮 mapping：

**Pass 1: Tech Focus**
- 探索 package.json/Cargo.toml/go.mod/requirements.txt、配置文件、依赖树
- 写入 `.planning/codebase/STACK.md` — 语言、runtime、framework、依赖、配置
- 写入 `.planning/codebase/INTEGRATIONS.md` — 外部 API、数据库、auth provider、webhook

**Pass 2: Architecture Focus**
- 探索目录结构、入口点、模块边界、数据流
- 写入 `.planning/codebase/ARCHITECTURE.md` — 模式、层次、数据流、抽象、入口点
- 写入 `.planning/codebase/STRUCTURE.md` — 目录布局、关键位置、命名约定

**Pass 3: Quality Focus**
- 探索代码风格、错误处理模式、测试文件、CI 配置
- 写入 `.planning/codebase/CONVENTIONS.md` — 代码风格、命名、模式、错误处理
- 写入 `.planning/codebase/TESTING.md` — framework、结构、mocking、覆盖率

**Pass 4: Concerns Focus**
- 探索 TODO、已知问题、脆弱区域、安全模式
- 写入 `.planning/codebase/CONCERNS.md` — 技术债、bug、安全、性能、脆弱区域

使用与 `gsd-codebase-mapper` agent 相同的文档模板。包含实际文件路径，并用反引号包裹。

继续到 verify_output。
</step>

<step name="verify_output">
验证所有文档都已成功创建：

```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

**Verification checklist:**
- 7 份文档都存在
- 没有空文档（每份都应超过 20 行）

如果缺少文档或存在空文档，记录可能失败的 agents。

继续到 scan_for_secrets。
</step>

<step name="scan_for_secrets">
**CRITICAL SECURITY CHECK:** 在提交前扫描输出文件，检查是否意外泄露 secrets。

运行 secret pattern 检测：

```bash
# Check for common API key patterns in generated docs
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' .planning/codebase/*.md 2>/dev/null && SECRETS_FOUND=true || SECRETS_FOUND=false
```

**如果 SECRETS_FOUND=true：**

```
⚠️  SECURITY ALERT: Potential secrets detected in codebase documents!

Found patterns that look like API keys or tokens in:
[show grep output]

This would expose credentials if committed.

**Action required:**
1. Review the flagged content above
2. If these are real secrets, they must be removed before committing
3. Consider adding sensitive files to Claude Code "Deny" permissions

Pausing before commit. Reply "safe to proceed" if the flagged content is not actually sensitive, or edit the files first.
```

在继续到 commit_codebase_map 之前，等待用户确认。

**如果 SECRETS_FOUND=false：**

继续到 commit_codebase_map。
</step>

<step name="commit_codebase_map">
提交 codebase map：

```bash
gsd-sdk query commit "docs: map existing codebase" .planning/codebase/*.md
```

继续到 offer_next。
</step>

<step name="offer_next">
展示完成摘要和下一步。

**获取行数：**
```bash
wc -l .planning/codebase/*.md
```

**输出格式：**

```
Codebase mapping complete.

Created .planning/codebase/:
- STACK.md ([N] lines) - Technologies and dependencies
- ARCHITECTURE.md ([N] lines) - System design and patterns
- STRUCTURE.md ([N] lines) - Directory layout and organization
- CONVENTIONS.md ([N] lines) - Code style and patterns
- TESTING.md ([N] lines) - Test structure and practices
- INTEGRATIONS.md ([N] lines) - External services and APIs
- CONCERNS.md ([N] lines) - Technical debt and issues


---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Initialize project** — use codebase context for planning

`/clear` then:

`/gsd-new-project`

---

**Also available:**
- Re-run mapping: `/gsd-map-codebase`
- Review specific file: `cat .planning/codebase/STACK.md`
- Edit any document before proceeding

---
```

结束 workflow。
</step>

</process>

<success_criteria>
- 已创建 `.planning/codebase/` 目录
- 若 Task tool 可用：已启动 4 个并行 `gsd-codebase-mapper` agents，并设置 `run_in_background=true`
- 若 Task tool 不可用：已在当前上下文中顺序完成 4 轮 mapping（绝不使用 `browser_subagent`）
- 7 份 codebase 文档都存在
- 没有空文档（每份都应超过 20 行）
- 有清晰的完成摘要和行数
- 向用户提供了清晰且符合 GSD 风格的下一步
</success_criteria>
