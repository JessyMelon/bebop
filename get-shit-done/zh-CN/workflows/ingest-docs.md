# Ingest Docs Workflow

扫描 repo 中混合的 planning 文档（ADR、PRD、SPEC、DOC），将其综合为统一上下文，并引导初始化或合并到 `.planning/`。

- `[path]` — 可选扫描目标目录（默认 repo root）
- `--mode new|merge` — 覆盖自动检测（默认：不存在 `.planning/` 时为 `new`，存在时为 `merge`）
- `--manifest <file>` — 列出每份文档 `{path, type, precedence?}` 的 YAML 文件；覆盖启发式分类
- `--resolve auto|interactive` — 冲突解决方式（v1 仅支持 `auto`；`interactive` 预留）

---

<step name="banner">

显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► INGEST DOCS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</step>

<step name="parse_arguments">

解析 `$ARGUMENTS`：

- 第一个位置参数（如果不是 flag）→ `SCAN_PATH`（默认：`.`）
- `--mode new|merge` → `MODE`（默认：自动检测）
- `--manifest <file>` → `MANIFEST_PATH`（可选）
- `--resolve auto|interactive` → `RESOLVE_MODE`（默认：`auto`；在 v1 中拒绝 `interactive`，并提示 "interactive resolution is planned for a future release"）

**验证路径：**

```bash
case "{SCAN_PATH}" in *..*) echo "SECURITY_ERROR: path contains traversal sequence"; exit 1 ;; esac
test -d "{SCAN_PATH}" || echo "PATH_NOT_FOUND"
if [ -n "{MANIFEST_PATH}" ]; then
  case "{MANIFEST_PATH}" in *..*) echo "SECURITY_ERROR: manifest path contains traversal"; exit 1 ;; esac
  test -f "{MANIFEST_PATH}" || echo "MANIFEST_NOT_FOUND"
fi
```

**Containment（必须）：** 将 `SCAN_PATH` 和 `MANIFEST_PATH` 相对 repo root 解析后，用 `realpath`（或平台等价命令）规范化，并断言结果位于 `realpath("$REPO_ROOT")` 之下。即使绝对路径不包含 `..`，只要位于 repo 外（如 `/tmp`、`C:\Windows`）也必须拒绝。

如果出现 `PATH_NOT_FOUND` 或 `MANIFEST_NOT_FOUND`：显示错误并退出。

</step>

<step name="init_and_mode_detect">

运行 init query：

```bash
INIT=$(gsd-sdk query init.ingest-docs)
```

从 INIT 中解析 `project_exists`、`planning_exists`、`has_git`、`project_path`。

如果未设置 MODE，则**自动检测 MODE**：
- `planning_exists: true` → `MODE=merge`
- `planning_exists: false` → `MODE=new`

如果用户传入 `--mode new` 但 `.planning/` 已存在：显示警告，并在覆盖前通过 `AskUserQuestion` 使用显式确认（来自 `references/gate-prompts.md` 的 approve-revise-abort）。

如果 `has_git: false` 且 `MODE=new`：初始化 git：
```bash
git init
```

按 `new-project.md` 相同模式**检测 runtime**：
- execution_context path `/.codex/` → `RUNTIME=codex`
- `/.gemini/` → `RUNTIME=gemini`
- `/.opencode/` 或 `/.config/opencode/` → `RUNTIME=opencode`
- 否则 → `RUNTIME=claude`

如果 execution_context 不可用，则回退到 env vars（`CODEX_HOME`、`GEMINI_CONFIG_DIR`、`OPENCODE_CONFIG_DIR`）。

</step>

<step name="discover_docs">

按以下顺序从三个来源构建文档列表：

**1. Manifest（如果提供）** — 作为权威来源：

读取 `MANIFEST_PATH`。期望的 YAML 结构：

```yaml
docs:
  - path: docs/adr/0001-db.md
    type: ADR
    precedence: 0   # optional, lower = higher precedence
  - path: docs/prd/auth.md
    type: PRD
```

每个条目提供 `path`（必填，相对 repo root）+ `type`（必填，值为 ADR|PRD|SPEC|DOC 之一）+ `precedence`（可选整数）。

**2. 目录约定**（提供 manifest 时跳过）：

```bash
# ADRs
find {SCAN_PATH} -type f \( -path '*/adr/*' -o -path '*/adrs/*' -o -name 'ADR-*.md' -o -regex '.*/[0-9]\{4\}-.*\.md' \) 2>/dev/null

# PRDs
find {SCAN_PATH} -type f \( -path '*/prd/*' -o -path '*/prds/*' -o -name 'PRD-*.md' \) 2>/dev/null

# SPECs / RFCs
find {SCAN_PATH} -type f \( -path '*/spec/*' -o -path '*/specs/*' -o -path '*/rfc/*' -o -path '*/rfcs/*' -o -name 'SPEC-*.md' -o -name 'RFC-*.md' \) 2>/dev/null

# Generic docs (fall-through candidates)
find {SCAN_PATH} -type f -path '*/docs/*' -name '*.md' 2>/dev/null
```

对合并结果去重（一个文件匹配多个模式也只算一份文档）。

**3. 内容启发式**（不在此处运行，而在分类阶段运行）— classifier 会处理未命中约定文档的 frontmatter `type:` 和 H1 检查。

**Cap：** 每次调用最多 50 份文档（v1 的明确限制）。如果发现的集合超过 50：

```
GSD > Discovered {N} docs, which exceeds the v1 cap of 50.
      Use --manifest to narrow the set to ≤ 50 files, or run
      /gsd-ingest-docs again with a narrower <path>.
```

退出，不继续执行。

**显示发现的集合**并请求批准（见 `references/gate-prompts.md`，可使用 `yes-no-pick` 或 `approve-revise-abort`）：

```
Discovered {N} documents:
  {N} ADR | {N} PRD | {N} SPEC | {N} DOC | {N} unclassified

  docs/adr/0001-architecture.md       [ADR]    (from manifest|directory|heuristic)
  docs/adr/0002-database.md           [ADR]    (directory)
  docs/prd/auth.md                    [PRD]    (manifest)
  ...
```

**Text mode：**应用与其他 workflow 相同的 `--text`/`text_mode` 规则，将 `AskUserQuestion` 替换为编号列表。

使用 `AskUserQuestion`（approve-revise-abort）：
- question: "Proceed with classification of these {N} documents?"
- header: "Approve?"
- options: Approve | Revise | Abort

若为 Abort：正常退出并显示 `Ingest cancelled.`。
若为 Revise：退出，并提示用 `--manifest` 或更窄的路径重新运行。

</step>

<step name="classify_parallel">

创建 staging 目录：

```bash
mkdir -p .planning/intel/classifications/
```

对每个发现的文档，并行启动 `gsd-doc-classifier`。在 Claude Code 中，在同一条消息里发出多个 Task 调用，以便 harness 并发执行。对于 Copilot / 顺序 runtime，则退回顺序调度。

每个子任务 prompt 字段：
- `FILEPATH` — 文档的绝对路径
- `OUTPUT_DIR` — `.planning/intel/classifications/`
- `MANIFEST_TYPE` — 如果 manifest 提供了类型，则传入；否则省略
- `MANIFEST_PRECEDENCE` — 如果 manifest 提供了 precedence 整数，则传入；否则省略
- `<required_reading>` — `agents/gsd-doc-classifier.md`（agent 定义本身）

收集每个 classifier 返回的一行确认消息。如果任一 classifier 出错，则向用户展示错误，并中止，不再进一步修改 `.planning/`。

</step>

<step name="synthesize">

只启动一次 `gsd-doc-synthesizer`：

```
Task({
  subagent_type: "gsd-doc-synthesizer",
  prompt: "
    CLASSIFICATIONS_DIR: .planning/intel/classifications/
    INTEL_DIR: .planning/intel/
    CONFLICTS_PATH: .planning/INGEST-CONFLICTS.md
    MODE: {MODE}
    EXISTING_CONTEXT: {paths to existing .planning files if MODE=merge, else empty}
    PRECEDENCE: {array from manifest defaults or default ['ADR','SPEC','PRD','DOC']}

    <required_reading>
    - agents/gsd-doc-synthesizer.md
    - get-shit-done/references/doc-conflict-engine.md
    </required_reading>
  "
})
```

synthesizer 会写入：
- `.planning/intel/decisions.md`、`.planning/intel/requirements.md`、`.planning/intel/constraints.md`、`.planning/intel/context.md`
- `.planning/intel/SYNTHESIS.md`
- `.planning/INGEST-CONFLICTS.md`

</step>

<step name="conflict_gate">

读取 `.planning/INGEST-CONFLICTS.md`。统计各 bucket 条目数（synthesizer 总会写出三段 bucket header；解析 `### BLOCKERS ({N})`、`### WARNINGS ({N})`、`### INFO ({N})` 这些行）。

应用 `references/doc-conflict-engine.md` 中的 safety 语义。Operation noun: `ingest`。

**如果 BLOCKERS > 0：**

将报告渲染给用户，然后显示：

```
GSD > BLOCKED: {N} blockers must be resolved before ingest can proceed.
```

退出，且**不要**写入 PROJECT.md、REQUIREMENTS.md、ROADMAP.md 或 STATE.md。staging intel 文件保留供检查。safety gate 生效，存在 blocker 时不写目标文件。

**如果 WARNINGS > 0 且 BLOCKERS = 0：**

渲染报告，然后通过 AskUserQuestion（approve-revise-abort）提问：
- question: "Review the competing variants above. Resolve manually and proceed, or abort?"
- header: "Approve?"
- options: Approve | Abort

若为 Abort：正常退出，并显示 `Ingest cancelled. Staged intel preserved at `.planning/intel/`.`。

**如果 BLOCKERS = 0 且 WARNINGS = 0：**

静默继续进入路由步骤，或可选显示 `GSD > No conflicts. Auto-resolved: {N}.`

</step>

<step name="route_new_mode">

**仅在 MODE=new 时适用。**

审查 `gsd-roadmapper` 期望的 PROJECT.md 字段。对于可由 `.planning/intel/SYNTHESIS.md` 推导的字段（项目范围、goals/non-goals、约束、locked decisions），从 intel 中综合生成。对于**无法**推导的字段（项目名、面向开发者的成功指标、目标 runtime），通过 `AskUserQuestion` 逐个询问，问题集保持最小，不要盘问式提问。

委派给 `gsd-roadmapper`：

```
Task({
  subagent_type: "gsd-roadmapper",
  prompt: "
    Mode: new-project-from-ingest
    Intel: .planning/intel/SYNTHESIS.md (entry point)
    Per-type intel: .planning/intel/{decisions,requirements,constraints,context}.md
    User-supplied fields: {collected in previous step}

    Produce:
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

    Treat ADR-locked decisions as locked in PROJECT.md <decisions> blocks.
  "
})
```

</step>

<step name="route_merge_mode">

**仅在 MODE=merge 时适用。**

加载现有的 `.planning/ROADMAP.md`、`.planning/PROJECT.md`、`.planning/REQUIREMENTS.md`，以及 `.planning/phases/` 下所有 `CONTEXT.md` 文件。

如果能执行到这一步，说明 synthesizer 已经对 ingest 中 LOCKED 与 existing 中 LOCKED 的冲突做了硬阻断；因此此时不存在此类 blocker。

规划 merge：
- synthesized `.planning/intel/requirements.md` 中不与现有 REQUIREMENTS.md 条目重叠的**新 requirements** → 追加到 REQUIREMENTS.md
- synthesized `.planning/intel/decisions.md` 中不与现有 CONTEXT.md `<decisions>` blocks 重叠的**新 decisions** → 写入新 phase 的 CONTEXT.md，或追加到下一个 milestone 的 requirements
- **新 scope** → 按 `new-milestone.md` 模式推导新增 phase；将 phase 追加到 `.planning/ROADMAP.md`

将 merge diff 预览给用户，并在写入前通过 approve-revise-abort 进行把关。

</step>

<step name="finalize">

提交 ingest 结果：

```bash
gsd-sdk query commit "docs: ingest {N} docs from {SCAN_PATH} (#2387)" \
  .planning/PROJECT.md \
  .planning/REQUIREMENTS.md \
  .planning/ROADMAP.md \
  .planning/STATE.md \
  .planning/intel/ \
  .planning/INGEST-CONFLICTS.md
```

（对于 merge mode，请替换为实际修改的文件集合。）

显示完成信息：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► INGEST DOCS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

显示：
- 运行模式（new 或 merge）
- 已导入文档（数量 + 类型拆分）
- 已锁定的 decisions、已创建的 requirements、已记录的 constraints
- 冲突报告路径（`.planning/INGEST-CONFLICTS.md`）
- 下一步：`/gsd-plan-phase 1`（new mode）或 `/gsd-plan-phase N`（merge，指向首个新增 phase）

</step>

---

## Anti-Patterns

不要：
- 违反 `references/doc-conflict-engine.md` 中共享的 conflict-engine 契约（不要 markdown table、不要新 severity label、不要绕过 BLOCKER gate）
- 在冲突报告存在 BLOCKER 时写入 PROJECT.md、REQUIREMENTS.md、ROADMAP.md 或 STATE.md
- 跳过 50 份文档上限；更大的集合必须用 `--manifest` 缩小范围
- 自动解决 LOCKED-vs-LOCKED 的 ADR 冲突；在两种模式下它们都属于 BLOCKER
- 将互相竞争的 PRD acceptance variants 合并成一个标准；应保留所有 variants 供用户决策
- 绕过 discovery approval gate；在启动 classifier 前，用户必须先看到已分类的文档列表
- 跳过对 `SCAN_PATH` 或 `MANIFEST_PATH` 的路径校验
- 在这个 v1 中实现 `--resolve interactive`；该 flag 仅作预留，应提示未来版本支持
