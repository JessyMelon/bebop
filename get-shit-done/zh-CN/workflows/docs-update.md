<purpose>
生成、更新并验证所有项目文档，包括规范文档类型与现有手写文档。编排器会检测项目的文档结构，组装一个跟踪每个条目的工作清单，在多个波次中并行分发 `doc-writer` 与 `doc-verifier` agent，审核现有文档的准确性，识别文档缺口，并通过有界修复循环修正文档中的不准确内容。所有状态都会持久化到工作清单中，因此不会在步骤之间丢失任何工作项。输出：根据结构感知生成、并针对实时代码库完成验证的完整文档。
</purpose>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 `general-purpose`）：
- gsd-doc-writer — 编写并更新项目文档文件
- gsd-doc-verifier — 依据实时代码库验证文档中的事实性陈述
</available_agent_types>

<process>

<step name="init_context" priority="first">
加载 docs-update 上下文：

```bash
INIT=$(gsd-sdk query docs-init)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(gsd-sdk query agent-skills gsd-doc-writer 2>/dev/null)
```

从 init JSON 提取：
- `doc_writer_model` — 传给每个新启动 agent 的 model 字符串（绝不要硬编码 model 名称）
- `commit_docs` — 完成后是否提交生成的文件
- `existing_docs` — 现有 Markdown 文件的 `{path, has_gsd_marker}` 对象数组
- `project_type` — 包含布尔信号的对象：`has_package_json`, `has_api_routes`, `has_cli_bin`, `is_open_source`, `has_deploy_config`, `is_monorepo`, `has_tests`
- `doc_tooling` — 包含布尔值的对象：`docusaurus`, `vitepress`, `mkdocs`, `storybook`
- `monorepo_workspaces` — workspace glob pattern 数组（若不是 monorepo 则为空）
- `project_root` — 项目根目录的绝对路径
</step>

<step name="classify_project">
将 init JSON 中 `project_type` 的布尔信号映射为主要类型标签，并收集条件文档信号。

**主要类型分类（首个匹配优先）：**

| Condition | primary_type |
|-----------|-------------|
| `is_monorepo` is true | `"monorepo"` |
| `has_cli_bin` is true AND `has_api_routes` is false | `"cli-tool"` |
| `has_api_routes` is true AND `is_open_source` is false | `"saas"` |
| `is_open_source` is true AND `has_api_routes` is false | `"open-source-library"` |
| (none of the above) | `"generic"` |

**条件文档信号（D-02 union 规则，主要分类后独立检查）：**

确定 `primary_type` 后，无论主要类型为何，都要独立检查每个信号。一个同时具备 API routes 且又是开源的 CLI tool，仍然要拿到全部三个条件文档。

| Signal | Conditional Doc |
|--------|----------------|
| `has_api_routes` is true | Queue API.md |
| `is_open_source` is true | Queue CONTRIBUTING.md |
| `has_deploy_config` is true | Queue DEPLOYMENT.md |

展示分类结果：
```
Project type: {primary_type}
Conditional docs queued: {list or "none"}
```
</step>

<step name="build_doc_queue">
根据始终启用的文档以及 `classify_project` 产生的条件文档，组装完整的文档队列。

**始终启用的文档（每个项目都入队，无例外）：**
1. README
2. ARCHITECTURE
3. GETTING-STARTED
4. DEVELOPMENT
5. TESTING
6. CONFIGURATION

**条件文档（仅在 `classify_project` 匹配到对应信号时加入）：**
- API（若 `has_api_routes`）
- CONTRIBUTING（若 `is_open_source`）
- DEPLOYMENT（若 `has_deploy_config`）

**重要：绝不要将 CHANGELOG.md 入队。文档队列只能由上面列出的 9 种已知文档类型构成。不要直接从 `existing_docs` 推导队列，`existing_docs` 仅在下一步中用于判定是 create 还是 update 模式。**

**文档队列上限：**最多 9 个文档。始终启用文档（6）加上最多 3 个条件文档，因此最多 9 个。

**CONTRIBUTING.md 确认（仅在新文件时）：**

如果 `CONTRIBUTING.md` 位于条件队列中，且没有出现在 init JSON 的 `existing_docs` 数组里：

1. 如果 `$ARGUMENTS` 中存在 `--force`：跳过此检查，将 `CONTRIBUTING.md` 纳入队列。

**Text mode（配置中的 `workflow.text_mode: true` 或 `--text` flag）：**如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 `TEXT_MODE` 时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入所选编号。这是 OpenAI Codex、Gemini CLI 等不提供 `AskUserQuestion` 的非 Claude 运行时所必需的。
2. 否则，使用 AskUserQuestion 进行确认：

```
AskUserQuestion([{
  question: "This project appears to be open source (LICENSE file detected). CONTRIBUTING.md does not exist yet. Would you like to create one?",
  header: "Contributing",
  multiSelect: false,
  options: [
    { label: "Yes, create it", description: "Generate CONTRIBUTING.md with project guidelines" },
    { label: "No, skip it", description: "This project does not need a CONTRIBUTING.md" }
  ]
}])
```

如果用户选择 `"No, skip it"`：将 `CONTRIBUTING.md` 从文档队列中移除。
如果 `CONTRIBUTING.md` 已经存在于 `existing_docs`：完全跳过此提示，并以 update 方式纳入。

**现有的非规范文档（review 队列）：**

在组装完上面的规范文档队列后，扫描 init JSON 中的 `existing_docs` 数组，找出那些与队列中的任何规范路径都不匹配的文件（既不匹配主路径，也不匹配 `resolve_modes` 表中的 fallback path）。这些就是手写文档，例如 `docs/api/endpoint-map.md` 或 `docs/frontend/pages/not-found.md`。

对每个找到的非规范现有文档：
- 加入单独的 `review_queue`
- 在 `verify_docs` 步骤中将其传给 `gsd-doc-verifier` 做准确性检查
- 如果发现不准确内容，则以 `fix` 模式分发给 `gsd-doc-writer` 进行手术式修正

如果找到了非规范文档，则在队列展示中显示它们：

```
Existing docs queued for accuracy review:
  - docs/api/endpoint-map.md (hand-written)
  - docs/api/README.md (hand-written)
  - docs/frontend/pages/not-found.md (hand-written)
```

如果一个也没找到，则省略此部分。

**文档缺口检测（缺失的非规范文档）：**

在组装完规范队列与 review 队列之后，分析代码库，识别那些本应存在文档却尚未编写的区域。这能确保该命令创建的是完整项目文档，而不是只覆盖那 9 种规范类型。

1. **扫描代码库中的未文档化区域：**
   - 使用 Glob/Grep 发现重要的源码目录（例如 `src/components/`, `src/pages/`, `src/services/`, `src/api/`, `lib/`, `routes/`）
   - 与现有文档进行比对：对每个主要源码目录，检查 docs 树中是否存在对应文档
   - 查看项目现有文档结构的模式，如果项目有 `docs/frontend/components/`、`docs/services/` 等，这些都表示项目自己的文档约定

2. **基于项目约定识别缺口：**
   - 如果项目有 `docs/` 目录并按子目录分组，那么每个已存在对应 docs 子目录但缺少文档文件的源码模块区域都代表一个缺口
   - 如果项目有 frontend components/pages 但没有 component docs，则标记出来
   - 如果项目有 service modules 但没有 service docs，则标记出来
   - 跳过已经被规范文档覆盖的区域（例如如果 `docs/API.md` 已在规范队列中，就不要再标记缺失 API 文档）

3. **向用户展示发现的缺口：**

```
AskUserQuestion([{
  question: "Found {N} documentation gaps in the codebase. Which should be created?",
  header: "Doc gaps",
  multiSelect: true,
  options: [
    { label: "{area}", description: "{why it needs docs — e.g., '5 components in src/components/ with no docs'}" },
    ...up to 4 options (group related gaps if more than 4)
  ]
}])
```

4. 对用户选中的每个缺口：
   - 以 `mode = "create"` 加入生成队列
   - 将输出路径设置为与项目现有文档目录结构一致
   - `gsd-doc-writer` 会收到一个 `doc_assignment`，其中 `type: "custom"`，并包含要记录内容的说明，同时把项目源码文件作为内容发现目标

如果未检测到任何缺口，则完全省略此部分。

在继续之前，先向用户展示组装后的队列：

展示来自 `resolve_modes` 的模式解析表（如上所示），然后展示：

```
{If non-canonical docs found, show as a table:}

Existing docs queued for accuracy review:

| Path | Type |
|------|------|
| {path} | hand-written |
| ... | ... |

CHANGELOG.md: excluded (out of scope)
```

模式解析表本身就是队列展示，它展示了每个文档的解析路径、模式与来源。不要再用另一种格式重复列出队列。

然后用 AskUserQuestion 确认：

```
AskUserQuestion([{
  question: "Doc queue assembled ({N} docs). Proceed with generation?",
  header: "Doc queue",
  multiSelect: false,
  options: [
    { label: "Proceed", description: "Generate all {N} docs in the queue" },
    { label: "Abort", description: "Cancel doc generation" }
  ]
}])
```

如果用户选择 `"Abort"`：退出该工作流。否则继续到 `resolve_modes`。
</step>

<step name="resolve_modes">
对组装后的队列中的每个文档，判断应当 create（新文件）还是 update（现有文件）。

**文档类型到规范路径的映射（默认值）：**

| Type | Default Path | Fallback Path |
|------|-------------|---------------|
| `readme` | `README.md` | — |
| `architecture` | `docs/ARCHITECTURE.md` | `ARCHITECTURE.md` |
| `getting_started` | `docs/GETTING-STARTED.md` | `GETTING-STARTED.md` |
| `development` | `docs/DEVELOPMENT.md` | `DEVELOPMENT.md` |
| `testing` | `docs/TESTING.md` | `TESTING.md` |
| `api` | `docs/API.md` | `API.md` |
| `configuration` | `docs/CONFIGURATION.md` | `CONFIGURATION.md` |
| `deployment` | `docs/DEPLOYMENT.md` | `DEPLOYMENT.md` |
| `contributing` | `CONTRIBUTING.md` | — |

**结构感知路径解析：**

在应用默认路径表之前，先检查项目现有 docs 目录的结构，以检测项目使用的是**分组子目录**还是**平铺文件**。这会决定所有新文档的放置方式。

**第 1 步：检测项目的 docs 组织模式。**

从 `existing_docs` 的路径中列出 `docs/` 下的子目录。如果项目有 2 个或更多子目录（例如 `docs/architecture/`、`docs/api/`、`docs/guides/`、`docs/frontend/`），则项目使用的是**分组结构**。如果文档只是直接平铺在 `docs/` 下（例如 `docs/ARCHITECTURE.md`），则使用的是**平铺结构**。

**第 2 步：根据检测到的模式解析路径。**

**如果检测到 GROUPED 结构：**

每种文档类型都必须放到合适的子目录中。当项目按组组织时，不应有任何文档平铺留在 `docs/` 根下。使用如下解析逻辑：

| Type | Subdirectory resolution (in priority order) |
|------|----------------------------------------------|
| `architecture` | existing `docs/architecture/` → create `docs/architecture/` if not present |
| `getting_started` | existing `docs/guides/` → existing `docs/getting-started/` → create `docs/guides/` |
| `development` | existing `docs/guides/` → existing `docs/development/` → create `docs/guides/` |
| `testing` | existing `docs/testing/` → existing `docs/guides/` → create `docs/testing/` |
| `api` | existing `docs/api/` → create `docs/api/` if not present |
| `configuration` | existing `docs/configuration/` → existing `docs/guides/` → create `docs/configuration/` |
| `deployment` | existing `docs/deployment/` → existing `docs/guides/` → create `docs/deployment/` |

对每种类型，都按从左到右检查解析链。使用第一个已存在的子目录；如果一个都不存在，就创建最右侧选项。

子目录内的文件名应当具备上下文语义，例如 `docs/guides/getting-started.md`、`docs/architecture/overview.md`、`docs/api/reference.md`，而不是 `docs/architecture/ARCHITECTURE.md`。应匹配该子目录中已有文件的命名风格（`lowercase-kebab`、`UPPERCASE` 等）。

**如果检测到 FLAT 结构（或不存在 `docs/` 目录）：**

直接使用上面的默认路径表（例如 `docs/ARCHITECTURE.md`、`docs/TESTING.md`）。

**第 3 步：保存每个解析路径并创建目录。**

对每种文档类型，将解析结果保存为 `resolved_path`。然后创建所有必需目录：
```bash
mkdir -p {each unique directory from resolved paths}
```

**模式解析逻辑：**

对队列中的每种文档类型：
1. 检查 `resolved_path` 是否出现在 init JSON 的 `existing_docs` 数组中
2. 如果在解析路径中没找到，再检查表中的 default path 与 fallback path
3. 如果在任一路径找到：`mode = "update"`，并用 Read tool 加载当前文件内容（在 `doc_assignment` block 中以 `existing_content` 传入）。使用找到的那个路径作为输出路径（不要移动现有文档）
4. 如果都没找到：`mode = "create"`，无需加载现有内容。使用 `resolved_path`

**确保 `docs/` 目录存在：**
继续下一步前，若 `docs/` 及所有解析出的子目录不存在，则创建它们：
```bash
mkdir -p docs/
```

**输出一张模式解析表：**

展示一张表，列出队列中每个文档的解析路径、模式与来源：

```
Mode resolution:

| Doc | Resolved Path | Mode | Source |
|-----|---------------|------|--------|
| readme | README.md | update | found at README.md |
| architecture | docs/architecture/overview.md | create | new directory |
| getting_started | docs/guides/getting-started.md | update | found, hand-written |
| development | docs/guides/development.md | create | matched docs/guides/ |
| testing | docs/guides/testing.md | create | matched docs/guides/ |
| configuration | docs/guides/configuration.md | create | matched docs/guides/ |
| api | docs/api/reference.md | create | new directory |
| deployment | docs/guides/deployment.md | update | found, hand-written |
```

这张表必须展示给用户，它是确认文件将写到哪里、以及哪些现有文件会被更新的主要依据。它会作为队列展示的一部分，在 AskUserQuestion 确认之前出现。

跟踪每个已入队文档的解析模式与文件路径。对 `update` 模式的文档，还要保存已加载的文件内容，后续步骤会传给 agent。

**关键：持久化工作清单。**

`resolve_modes` 完成后，将所有工作项写入 `.planning/tmp/docs-work-manifest.json`。这是后续每一步的单一事实来源，编排器在每个步骤都必须读取这个文件，而不是依赖内存。

```bash
mkdir -p .planning/tmp
```

使用 Write tool 写入清单：

```json
{
  "canonical_queue": [
    {
      "type": "readme",
      "resolved_path": "README.md",
      "mode": "create|update|supplement",
      "preservation_mode": null,
      "wave": 1,
      "status": "pending"
    }
  ],
  "review_queue": [
    {
      "path": "docs/frontend/components/button.md",
      "type": "hand-written",
      "status": "pending_review"
    }
  ],
  "gap_queue": [
    {
      "description": "Frontend components in src/components/",
      "output_path": "docs/frontend/components/overview.md",
      "status": "pending"
    }
  ],
  "created_at": "{ISO timestamp}"
}
```

之后的每一步（`dispatch`、`collect`、`verify`、`fix_loop`、`report`）都必须先读取 `.planning/tmp/docs-work-manifest.json`，并更新其处理条目的 `status` 字段。这能防止编排器在多步骤工作流中“忘记”任何工作项。
</step>

<step name="preservation_check">
检查队列中的手写文档，并在分发前收集用户决策。

**跳过条件（按顺序检查）：**

1. 如果 `$ARGUMENTS` 中存在 `--force`：将所有文档视为 `mode: regenerate`，并跳到 `detect_runtime_capabilities`。
2. 如果 `$ARGUMENTS` 中存在 `--verify-only`：跳到 `verify_only_report`（不要继续到 `detect_runtime_capabilities`）。
3. 如果队列中没有任何文档在 `existing_docs` 数组中满足 `has_gsd_marker: false`：跳到 `detect_runtime_capabilities`。

**对每个 `has_gsd_marker` 为 false 的已入队文档（检测到手写文档）：**

如果可用，使用 `AskUserQuestion` 呈现以下选择，否则使用内联提示：

```
{filename} appears to be hand-written (no GSD marker found).

How should this file be handled?
  [1] preserve    -- Skip entirely. Leave unchanged.
  [2] supplement  -- Append only missing sections. Existing content untouched.
  [3] regenerate  -- Overwrite with a fresh GSD-generated doc.
```

记录每个决策，并更新文档队列：
- `preserve` 决策：将该文档从队列中完全移除
- `supplement` 决策：在 `doc_assignment` block 中将 `mode` 设为 `supplement`；并包含 `existing_content`（完整文件内容）
- `regenerate` 决策：将 `mode` 设为 `create`（按全新写入处理）

**当 AskUserQuestion 不可用时的回退行为：**默认将所有手写文档设为 `preserve`（最安全的默认值）。显示消息：

```
AskUserQuestion unavailable — hand-written docs preserved by default.
Use --force to regenerate all docs, or re-run in Claude Code to get per-file prompts.
```

记录完所有决策后，继续到 `detect_runtime_capabilities`。
</step>

<!-- If Task tool is unavailable at runtime, skip dispatch/collect waves and use sequential_generation instead. -->

<step name="dispatch_wave_1" condition="Task tool is available">
**先读取工作清单：**`Read .planning/tmp/docs-work-manifest.json`，本步骤使用其中 `wave: 1` 的 `canonical_queue` 条目。

为 Wave 1 文档并行启动 3 个 `gsd-doc-writer` agent：README、ARCHITECTURE、CONFIGURATION。

这些是基础文档，不需要交叉引用，因此非常适合并行生成。

对这三个 agent 全部使用 `run_in_background=true` 以启用并行执行。

**Agent 1: README**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate README.md for target project",
  prompt="<doc_assignment>
type: readme
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent 2: ARCHITECTURE**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate ARCHITECTURE.md for target project",
  prompt="<doc_assignment>
type: architecture
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent 3: CONFIGURATION**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate CONFIGURATION.md for target project",
  prompt="<doc_assignment>
type: configuration
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
note: Apply VERIFY markers to any infrastructure claim not discoverable from the repository.
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**关键：**agent prompt 只能包含 `<doc_assignment>` block、`${AGENT_SKILLS}` 变量，以及返回说明。不要在 agent prompt 中加入项目规划上下文、工作流说明文字或任何内部工具引用。

继续到 `collect_wave_1`。
</step>

<step name="collect_wave_1">
**先读取工作清单：**`Read .planning/tmp/docs-work-manifest.json`。收集后，将每个 Wave 1 条目的 `status` 更新为 `"completed"` 或 `"failed"`。然后将更新后的清单写回磁盘。

使用 `TaskOutput` tool 等待全部 3 个 Wave 1 agent 完成。

并行调用全部 3 个 agent 的 `TaskOutput`（单条消息内包含 3 个 `TaskOutput` 调用）：

```
TaskOutput tool:
  task_id: "{task_id from README agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from ARCHITECTURE agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from CONFIGURATION agent result}"
  block: true
  timeout: 300000
```

**每个 agent 预期返回的确认格式：**
```
## Doc Generation Complete
**Type:** {type}
**Mode:** {mode}
**File written:** `{path}` ({N} lines)
Ready for orchestrator summary.
```

**收集后，使用每个 manifest 条目的 `resolved_path` 验证 Wave 1 文件确实存在于磁盘上：**
```bash
ls -la {resolved_path_1} {resolved_path_2} {resolved_path_3} 2>/dev/null
```

如果任一 agent 失败，或者它的文件缺失：
- 记录失败情况
- 继续处理成功的文档（不要因为单个失败而停止 Wave 2）
- 缺失文档会在最终报告中注明

继续到 `dispatch_wave_2`。
</step>

<step name="dispatch_wave_2" condition="Task tool is available">
**先读取工作清单：**`Read .planning/tmp/docs-work-manifest.json`，本步骤使用其中 `wave: 2` 的 `canonical_queue` 条目。

为所有已入队的 Wave 2 文档启动 agent：GETTING-STARTED、DEVELOPMENT、TESTING，以及在 `build_doc_queue` 中被加入的所有条件文档（API、DEPLOYMENT、CONTRIBUTING）。

Wave 2 agent 可以引用 Wave 1 的输出用于交叉引用，因此在每个 `doc_assignment` block 中加入 `wave_1_outputs` 字段。

对所有 Wave 2 agent 使用 `run_in_background=true`，以在波次内部启用并行执行。

**Agent: GETTING-STARTED**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate GETTING-STARTED.md for target project",
  prompt="<doc_assignment>
type: getting_started
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent: DEVELOPMENT**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate DEVELOPMENT.md for target project",
  prompt="<doc_assignment>
type: development
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent: TESTING**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate TESTING.md for target project",
  prompt="<doc_assignment>
type: testing
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Conditional Agent: API**（仅当 `has_api_routes` 为 true，即只有在 `API.md` 已入队时才启动）

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate API.md for target project",
  prompt="<doc_assignment>
type: api
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Conditional Agent: DEPLOYMENT**（仅当 `has_deploy_config` 为 true，即只有在 `DEPLOYMENT.md` 已入队时才启动）

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate DEPLOYMENT.md for target project",
  prompt="<doc_assignment>
type: deployment
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
note: Apply VERIFY markers to any infrastructure claim not discoverable from the repository.
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Conditional Agent: CONTRIBUTING**（仅当 `is_open_source` 为 true，即只有在 `CONTRIBUTING.md` 已入队时才启动）

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate CONTRIBUTING.md for target project",
  prompt="<doc_assignment>
type: contributing
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**关键：**agent prompt 只能包含 `<doc_assignment>` block、`${AGENT_SKILLS}` 变量，以及返回说明。不要在 agent prompt 中加入项目规划上下文、工作流说明文字或任何内部工具引用。

继续到 `collect_wave_2`。
</step>

<step name="collect_wave_2">
**先读取工作清单：**`Read .planning/tmp/docs-work-manifest.json`。收集后，将每个 Wave 2 条目的 `status` 更新为 `"completed"` 或 `"failed"`。然后将更新后的清单写回磁盘。

使用 `TaskOutput` tool 等待所有 Wave 2 agent 完成。

并行调用所有 Wave 2 agent 的 `TaskOutput`（单条消息内包含 N 个 `TaskOutput` 调用，每个已启动的 Wave 2 agent 一个）：

```
TaskOutput tool:
  task_id: "{task_id from GETTING-STARTED agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from DEVELOPMENT agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from TESTING agent result}"
  block: true
  timeout: 300000

# Add one TaskOutput call per conditional agent spawned (API, DEPLOYMENT, CONTRIBUTING)
```

**收集后，使用每个 manifest 条目的 `resolved_path` 验证所有 Wave 2 文件确实存在于磁盘上：**
```bash
ls -la {resolved_path for each wave 2 item} 2>/dev/null
```

如果任一 agent 失败，或者其文件缺失，记录失败并继续。缺失文档会在最终报告中说明。

如果 `monorepo_workspaces` 非空，则继续到 `dispatch_monorepo_packages`；否则继续到 `commit_docs`。
</step>

<step name="dispatch_monorepo_packages" condition="monorepo_workspaces is non-empty">
在 Wave 2 收集完成后，为每个 monorepo workspace 生成 package 级 README。

**条件：**仅当 init JSON 中的 `monorepo_workspaces` 非空时才运行此步骤。

**从 glob patterns 解析 workspace packages：**

```bash
# Expand workspace globs to actual package directories
for pattern in {monorepo_workspaces}; do
  ls -d $pattern 2>/dev/null
done
```

**对每个包含 `package.json` 的解析目录：**

确定模式：
- 如果 `{package_dir}/README.md` 存在：`mode = update`，读取现有内容
- 否则：`mode = create`

使用 `run_in_background=true` 启动一个 `gsd-doc-writer` agent：

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate per-package README for {package_dir}",
  prompt="<doc_assignment>
type: readme
mode: {create|update}
scope: per_package
package_dir: {absolute path to package directory}
project_context: {INIT JSON with project_root set to package directory}
{existing_content: | (include full README.md content here if mode is update, else omit)}
</doc_assignment>

{AGENT_SKILLS}

Write {package_dir}/README.md directly. Return confirmation only — do not return doc content."
)
```

使用 `TaskOutput` 收集所有 package agent 的确认结果。将失败情况写入最终报告。

**当 Task tool 不可用时的回退行为：**在 `sequential_generation` 步骤之后，按顺序内联生成 package 级 README。对每个包含 `package.json` 的 package 目录，构造等价的 `doc_assignment` block，并遵循 `gsd-doc-writer` 的说明生成 README。

继续到 `commit_docs`。
</step>

<step name="sequential_generation" condition="Task tool is NOT available (e.g. Antigravity, Gemini CLI, Codex, Copilot)">
**先读取工作清单：**`Read .planning/tmp/docs-work-manifest.json`，并按其中的 `canonical_queue` 条目顺序生成。每生成完一个文档就更新 `status`。所有文档完成后，将更新后的清单写回磁盘。

当 `Task` tool 不可用时，在当前上下文中顺序生成文档。这个步骤会替代 `dispatch_wave_1`、`collect_wave_1`、`dispatch_wave_2` 和 `collect_wave_2`。

**重要：**不要使用 `browser_subagent`、`Explore` 或任何基于浏览器的工具。只使用文件系统工具（Read、Bash、Write、Grep、Glob，或当前运行时可用的等价工具）。

开始之前，先读取一次 `agents/gsd-doc-writer.md` 的说明。对每个文档，沿用并行路径中的同一组 `doc_assignment` 字段，遵循该 agent 的 `create_mode` 或 `update_mode` 说明。

**Wave 1（顺序执行，三个都完成后再开始 Wave 2）：**

对每个 Wave 1 文档，构造等价的 `doc_assignment` block，并内联生成文件：

1. **README** — 模式来自 `resolve_modes`；若为 `update`/`supplement`，包含 `existing_content`
   - 构造 `doc_assignment`：`type: readme`、`mode: {create|update|supplement}`、`preservation_mode: {value|null}`、`project_context: {INIT JSON}`、`existing_content:`（若为 `update`/`supplement`）
   - 按照 `gsd-doc-writer` 的 `create_mode` / `update_mode` 说明探索代码库（Read、Grep、Glob、Bash）
   - 将文件写入解析出的路径（`README.md`）

2. **ARCHITECTURE** — 模式来自 `resolve_modes`；若为 `update`/`supplement`，包含 `existing_content`
   - 构造 `doc_assignment`：`type: architecture`、`mode: {create|update|supplement}`、`preservation_mode: {value|null}`、`project_context: {INIT JSON}`、`existing_content:`（若为 `update`/`supplement`）
   - 按照 `gsd-doc-writer` 说明探索代码库
   - 将文件写入解析出的路径（`docs/ARCHITECTURE.md`，若使用根目录 fallback 则为 `ARCHITECTURE.md`）

3. **CONFIGURATION** — 模式来自 `resolve_modes`；若为 `update`/`supplement`，包含 `existing_content`
   - 构造 `doc_assignment`：`type: configuration`、`mode: {create|update|supplement}`、`preservation_mode: {value|null}`、`project_context: {INIT JSON}`、`existing_content:`（若为 `update`/`supplement`）
   - 对仓库中无法发现依据的基础设施陈述添加 VERIFY markers
   - 按照 `gsd-doc-writer` 说明探索代码库
   - 将文件写入解析出的路径（`docs/CONFIGURATION.md`，若使用根目录 fallback 则为 `CONFIGURATION.md`）

**Wave 2（顺序执行，只有在所有 Wave 1 文档都写完后才能开始）：**

由于 Wave 1 输出已写入，Wave 2 文档可以引用它们。在每个 `doc_assignment` 中包含 `wave_1_outputs`。

4. **GETTING-STARTED** — 模式来自 `resolve_modes`；包含 `wave_1_outputs: [README.md, docs/ARCHITECTURE.md, docs/CONFIGURATION.md]`
5. **DEVELOPMENT** — 模式来自 `resolve_modes`；包含 `wave_1_outputs`
6. **TESTING** — 模式来自 `resolve_modes`；包含 `wave_1_outputs`
7. **API**（仅当已入队）— 模式来自 `resolve_modes`；包含 `wave_1_outputs`
8. **DEPLOYMENT**（仅当已入队）— 对仓库中无法发现依据的基础设施陈述添加 VERIFY markers；包含 `wave_1_outputs`
9. **CONTRIBUTING**（仅当已入队）— 模式来自 `resolve_modes`；包含 `wave_1_outputs`

**Monorepo package 级 README（仅当 `monorepo_workspaces` 非空）：**

当所有 9 个根级文档都写完后，顺序生成 package 级 README：

对每个通过 workspace glob 展开后得到、且包含 `package.json` 的 package 目录：
- 确定模式：若 `{package_dir}/README.md` 存在，则 `mode = update`；否则 `mode = create`
- 构造 `doc_assignment`：`type: readme`、`mode: {create|update}`、`scope: per_package`、`package_dir: {absolute path}`、`project_context: {INIT JSON with project_root set to package directory}`、`existing_content:`（若为 `update`）
- 按 `per_package` scope 遵循 `gsd-doc-writer` 说明
- 将文件写入 `{package_dir}/README.md`

继续到 `verify_docs`。
</step>

<step name="verify_docs">
依据实时代码库验证所有文档中的事实性陈述，包括规范文档（生成的）和非规范文档（现有手写文档）。

**关键：先读取工作清单。**

```
Read .planning/tmp/docs-work-manifest.json
```

提取 `canonical_queue`（`status: "completed"` 的条目）和 `review_queue`（`status: "pending_review"` 的条目）。本步骤会同时验证这两个队列。

**跳过条件：**如果 `$ARGUMENTS` 中存在 `--verify-only`，则该步骤已由 `verify_only_report` 处理（提前退出）。跳过。

**Phase 1: 验证规范文档（生成/更新的文档）**

对 `canonical_queue` 中每个已成功写入磁盘的文档：

1. 使用 `<verify_assignment>` block 启动 `gsd-doc-verifier` agent（如果 `Task` tool 不可用，则顺序调用）：
   ```xml
   <verify_assignment>
   doc_path: {relative path to the doc file, e.g. README.md}
   project_root: {project_root from init JSON}
   </verify_assignment>
   ```

2. verifier 完成后，读取 `.planning/tmp/verify-{doc_filename}.json` 中的结果 JSON。

3. 更新清单：将每个已处理的规范文档 `status` 设为 `"verified"`。

**Phase 2: 验证非规范文档（现有手写文档）**

这一步不是可选项。`review_queue` 中的每个文档都必须验证。

对 manifest 中 `review_queue` 的每个文档：

1. 使用与上面相同的 `<verify_assignment>` block 启动 `gsd-doc-verifier` agent。
2. 读取 `.planning/tmp/verify-{doc_filename}.json` 中的结果 JSON。
3. 更新清单：将每个已处理的 `review_queue` 文档 `status` 设为 `"verified"`。

带有失败项的非规范文档也符合进入 `fix_loop` 的条件。当某个非规范文档存在 `claims_failed > 0` 时，将其以 `fix` 模式分发给 `gsd-doc-writer`，并附带 `failures` 数组。writer 的 `fix` 模式会针对特定行进行手术式修正，与文档类型无关（无需模板）。writer 不得对失败陈述之外的任何内容进行重构、改写或重新格式化。

**Phase 3: 展示合并后的验证摘要**

将全部结果（规范文档 + 非规范文档）收集到一个 `verification_results` 数组中：

```
Verification results:

Canonical docs (generated):

| Doc                    | Claims | Passed | Failed |
|------------------------|--------|--------|--------|
| README.md              | 12     | 10     | 2      |
| docs/architecture/overview.md | 8 | 8   | 0      |

Existing docs (reviewed):

| Doc                    | Claims | Passed | Failed |
|------------------------|--------|--------|--------|
| docs/frontend/components/button.md | 5 | 4 | 1   |
| docs/services/api.md   | 8      | 8      | 0      |

Total: {total_checked} claims checked, {total_failed} failures
```

将更新后的清单写回磁盘。

如果所有文档都满足 `claims_failed === 0`：跳过 `fix_loop`，继续到 `scan_for_secrets`。
如果任意文档（规范或非规范）满足 `claims_failed > 0`：继续到 `fix_loop`。
</step>

<step name="fix_loop">
**先读取工作清单：**`Read .planning/tmp/docs-work-manifest.json`。从 `.planning/tmp/verify-*.json` 的验证结果中识别所有 `claims_failed > 0` 的文档（规范与非规范都要）。两个队列都可以进入修复。

通过将失败文档重新发送给 `doc-writer` 的 `fix` 模式来修正被标记的不准确内容。按照 D-06，最多迭代 2 次。按照 D-05，发现回归立即停止。

**跳过条件：**如果所有文档都通过验证（无失败），跳过此步骤。

**迭代跟踪：**
- `MAX_FIX_ITERATIONS = 2`
- `iteration = 0`
- `previous_passed_docs` = 初始验证后所有 `claims_failed === 0` 的 `doc_paths` 集合

**每次迭代（只要 `iteration < MAX_FIX_ITERATIONS` 且仍有失败文档）：**

1. 对最新 `verification_results` 中每个 `claims_failed > 0` 的文档：
   a. 从磁盘读取当前文件内容。
   b. 启动 `gsd-doc-writer` agent（或顺序调用），使用如下 `fix assignment`：
      ```xml
      <doc_assignment>
      type: {original doc type from the queue, e.g. readme}
      mode: fix
      doc_path: {relative path}
      project_context: {INIT JSON}
      existing_content: {current file content read from disk}
      failures:
        - line: {line}
          claim: "{claim}"
          expected: "{expected}"
          actual: "{actual}"
      </doc_assignment>
      ```
   c. 每个失败文档单独启动一个 agent。不要把多个文档合并进一次启动。

2. 所有 fix agent 完成后，重新验证所有文档（不只是被修复过的那些）：
   - 重新运行与 `verify_docs` 步骤相同的验证流程。
   - 读取 `.planning/tmp/verify-{doc_filename}.json` 中更新后的结果 JSON。

3. **回归检测（D-05）：**
   对新的 `verification_results` 中每个文档：
   - 如果某个文档此前位于 `previous_passed_docs` 中（上一轮已通过），但现在出现 `claims_failed > 0`，这就是一次回归。
   - 一旦检测到回归：立即停止循环。展示：
     ```
     REGRESSION DETECTED -- halting fix loop.

     {doc_path} previously passed verification but now has {claims_failed} failures after fix iteration {iteration + 1}.

     This means the fix introduced new errors. Remaining failures require manual review.
     ```
     然后继续到 `scan_for_secrets`（不要再尝试进一步修复）。

4. 用当前已通过的文档更新 `previous_passed_docs`。
5. 将 `iteration` 加一。

**达到循环上限后（`iteration === MAX_FIX_ITERATIONS` 且仍有失败）：**

展示剩余失败项：
```
Fix loop completed ({MAX_FIX_ITERATIONS} iterations). Remaining failures:

| Doc               | Failed Claims |
|-------------------|---------------|
| {doc_path}        | {count}       |

These failures require manual correction. Review the verification output in .planning/tmp/verify-*.json for details.
```

继续到 `scan_for_secrets`。
</step>

<step name="verify_only_report">
**当 `$ARGUMENTS` 中存在 `--verify-only` 时会到达此步骤。**这是一个提前退出步骤，在此之后不要继续到分发、生成、提交或报告步骤。

对 init JSON 的 `existing_docs` 中每个文件，以只读模式调用 `gsd-doc-verifier` agent：

1. 对 `existing_docs` 中每个文档：
   a. 启动 `gsd-doc-verifier`（若 `Task` tool 不可用则顺序调用），使用：
      ```xml
      <verify_assignment>
      doc_path: {doc.path}
      project_root: {project_root from init JSON}
      </verify_assignment>
      ```
   b. 读取 `.planning/tmp/verify-{doc_filename}.json` 中的结果 JSON。

2. 同时统计每个文档中的 VERIFY markers：在文件内容中 grep `<!-- VERIFY:`。

展示汇总表：

```
--verify-only audit:

| File                     | Claims Checked | Passed | Failed | VERIFY Markers |
|--------------------------|----------------|--------|--------|----------------|
| README.md                | 12             | 10     | 2      | 0              |
| docs/ARCHITECTURE.md     | 8              | 8      | 0      | 0              |
| docs/CONFIGURATION.md    | 5              | 3      | 2      | 5              |
| ...                 | ...            | ...    | ...    | ...            |

Total: {total_checked} claims checked, {total_failed} failures, {total_markers} VERIFY markers requiring manual review
```

如果存在失败，展示详情：
```
Failed claims:
  README.md:34 - "src/cli/index.ts" (expected: file exists, actual: file not found)
  docs/CONFIGURATION.md:12 - "npm run deploy" (expected: script in package.json, actual: script not found)
```

显示提示：
```
To fix failures automatically: /gsd-docs-update (runs generation + fix loop)
To regenerate all docs from scratch: /gsd-docs-update --force
```

清理临时文件：删除 `.planning/tmp/verify-*.json`。

结束工作流，不要继续到任何分发、提交或报告步骤。
</step>

<step name="scan_for_secrets">
关键安全检查：在提交前扫描所有生成/更新过的文档文件，防止意外泄露 secrets。按照 D-07，这一步在 `fix_loop` 完成后、`commit_docs` 之前只运行一次。

根据生成队列构建文件列表，包含所有已写入磁盘的文档（create、update、supplement 或 fix）。不要硬编码静态列表；使用实际生成或修改过的文件列表。

执行 secret pattern 检测：

```bash
# Check for common API key patterns in generated docs
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' \
  {space-separated list of generated doc files} 2>/dev/null \
  && SECRETS_FOUND=true || SECRETS_FOUND=false
```

**如果 `SECRETS_FOUND=true`：**

```
SECURITY ALERT: Potential secrets detected in generated documentation!

Found patterns that look like API keys or tokens in:
{show grep output}

This would expose credentials if committed.

Action required:
1. Review the flagged lines above
2. Remove any real secrets from the doc files
3. Re-run /gsd-docs-update to regenerate clean docs
```

然后使用 AskUserQuestion 确认：

```
AskUserQuestion([{
  question: "Potential secrets detected in generated docs. How would you like to proceed?",
  header: "Security",
  multiSelect: false,
  options: [
    { label: "Safe to proceed", description: "I've reviewed the flagged lines — no real secrets, commit the docs" },
    { label: "Abort commit", description: "Skip committing — I'll clean up the docs first" }
  ]
}])
```

如果用户选择 `"Abort commit"`：跳过 `commit_docs` 并继续到 `report`。如果选择 `"Safe to proceed"`：继续到 `commit_docs`。

**如果 `SECRETS_FOUND=false`：**

继续到 `commit_docs`。
</step>

<step name="commit_docs">
仅当 init JSON 中 `commit_docs` 为 `true` 时运行此步骤。如果 `commit_docs` 为 false，则跳到 `report`。

组装实际已生成文件的列表（不要包含失败或被跳过的文件）：

```bash
gsd-sdk query commit "docs: generate project documentation" \
  --files README.md docs/ARCHITECTURE.md docs/CONFIGURATION.md docs/GETTING-STARTED.md docs/DEVELOPMENT.md docs/TESTING.md
# Append any conditional docs that were generated:
# --files ... docs/API.md docs/DEPLOYMENT.md CONTRIBUTING.md
# Append per-package READMEs if monorepo dispatch ran:
# --files ... packages/core/README.md packages/cli/README.md
```

只包含那些已成功写入磁盘的文件。不要包含失败或被跳过的文档。

继续到 `report`。
</step>

<step name="report">
**先读取工作清单：**`Read .planning/tmp/docs-work-manifest.json`，并基于该清单编制完整报告，覆盖所有规范文档、`review_queue` 结果和 `gap_queue` 结果。工作清单是已处理内容的事实来源。

向用户展示完成摘要。

**摘要格式：**

```
Documentation generation complete.

Project type: {primary_type}

Generated docs:
| File                     | Mode   | Lines |
|--------------------------|--------|-------|
| README.md                | create | 87    |
| docs/ARCHITECTURE.md     | update | 124   |
| docs/GETTING-STARTED.md  | create | 63    |
| docs/DEVELOPMENT.md      | create | 71    |
| docs/TESTING.md          | create | 58    |
| docs/CONFIGURATION.md    | create | 45    |
[conditional docs if generated]

{If monorepo per-package READMEs were generated:}
Per-package READMEs:
| Package             | Mode   | Lines |
|---------------------|--------|-------|
| packages/core       | create | 42    |
| packages/cli        | create | 38    |

{If any docs failed or were skipped:}
Skipped / failed:
  - docs/API.md: agent did not complete

{If preservation_check ran:}
Preservation decisions:
  - {filename}: {preserve|supplement|regenerate}

{If docs/DEPLOYMENT.md or docs/CONFIGURATION.md were generated:}
VERIFY markers: {N} markers placed in docs/DEPLOYMENT.md and/or docs/CONFIGURATION.md for infrastructure claims that require manual verification.

{If review_queue was non-empty:}

Existing doc accuracy review:

| Doc | Claims Checked | Passed | Failed | Fixed |
|-----|----------------|--------|--------|-------|
| docs/api/endpoint-map.md | 5 | 4 | 1 | 1 |

{For any remaining unfixed failures after fix_loop:}
Remaining inaccuracies could not be auto-corrected — manual review recommended for flagged items above.

{If commit_docs was true:}
All generated files committed.
```

提醒用户可以对生成的文档做事实核查：

```
Run `/gsd-docs-update --verify-only` to fact-check generated docs against the codebase.
```

结束工作流。
</step>

</process>

<success_criteria>
- [ ] docs-init JSON loaded and all fields extracted
- [ ] Project type correctly classified from project_type signals
- [ ] Doc queue contains all always-on docs plus only the conditional docs matching project signals
- [ ] CHANGELOG.md was NOT generated or queued
- [ ] Each doc was generated in correct mode (create for new, update for existing)
- [ ] Wave 1 docs (README, ARCHITECTURE, CONFIGURATION) completed before Wave 2 started
- [ ] Generated docs contain zero GSD methodology content
- [ ] docs/DEPLOYMENT.md and docs/CONFIGURATION.md use VERIFY markers for undiscoverable claims (if generated)
- [ ] All generated files committed (if commit_docs is true)
- [ ] Hand-written docs (no GSD marker) prompted for preserve/supplement/regenerate before dispatch (unless --force)
- [ ] --force flag skipped preservation prompts and regenerated all docs
- [ ] --verify-only flag reported doc status without generating files
- [ ] Per-package READMEs generated for monorepo workspaces (if applicable)
- [ ] verify_docs step checked all generated docs against the live codebase
- [ ] fix_loop ran at most 2 iterations and halted on regression
- [ ] scan_for_secrets ran before commit and blocked on detected patterns
- [ ] --verify-only invokes gsd-doc-verifier for full fact-checking (not just VERIFY marker count)
</success_criteria>
