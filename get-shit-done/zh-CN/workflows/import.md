# Import Workflow

导入外部计划，包含冲突检测和 agent 委派。

- `--from`: 导入外部计划 → 冲突检测 → 写入 PLAN.md → 通过 gsd-plan-checker 验证

未来：计划在后续 PR 中支持 `--prd` 模式（将 PRD 提取到 PROJECT.md + REQUIREMENTS.md + ROADMAP.md）。

---

<step name="banner">

显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</step>

<step name="parse_arguments">

解析 `$ARGUMENTS` 以确定执行模式：

- 如果存在 `--from`：提取 FILEPATH（`--from` 后的下一个 token），设置 MODE=plan
- 如果存在 `--prd`：显示 `--prd` 尚未实现并退出：
  ```
  GSD > --prd mode is planned for a future release. Use --from to import plan files.
  ```
- 如果两个 flag 都不存在：显示用法并退出：

```
Usage: /gsd-import --from <path>

  --from <path>   Import an external plan file into GSD format
```

**验证文件路径：**

确认路径不包含 traversal 序列，且文件存在：

```bash
case "{FILEPATH}" in
  *..* ) echo "SECURITY_ERROR: path contains traversal sequence"; exit 1 ;;
esac
test -f "{FILEPATH}" || echo "FILE_NOT_FOUND"
```

如果 FILE_NOT_FOUND：显示错误并退出：

```
╔══════════════════════════════════════════════════════════════╗
║  ERROR                                                       ║
╚══════════════════════════════════════════════════════════════╝

File not found: {FILEPATH}

**To fix:** Verify the file path and try again.
```

</step>

---

## Path A: MODE=plan (--from)

<step name="plan_load_context">

为冲突检测加载项目上下文：

1. 读取 `.planning/ROADMAP.md`，提取阶段结构、阶段编号、依赖关系
2. 读取 `.planning/PROJECT.md`，提取项目约束、技术栈、范围边界。
   **如果 PROJECT.md 不存在：**跳过依赖它的约束检查，并显示：
   ```
   GSD > Note: No PROJECT.md found. Conflict checks against project constraints will be skipped.
   ```
3. 读取 `.planning/REQUIREMENTS.md`，提取现有需求，用于重叠和冲突检查。
   **如果 REQUIREMENTS.md 不存在：**跳过需求冲突检查并继续。
4. Glob 匹配所有 phase 目录中的 CONTEXT.md 文件：
   ```bash
   find .planning/phases/ -name "*-CONTEXT.md" -o -name "CONTEXT.md" 2>/dev/null
   ```
   读取每个找到的 CONTEXT.md，提取锁定决策（`<decisions>` block 中的任何决策）

将加载得到的上下文保存下来，用于下一步的冲突检测。

</step>

<step name="plan_read_input">

读取 FILEPATH 指向的导入文件。

判断格式：
- **GSD PLAN.md 格式**：包含带 `phase:`、`plan:`、`type:` 字段的 YAML frontmatter
- **自由格式文档**：其他任意格式（markdown 规范、设计文档、任务列表等）

从导入内容中提取：
- **Phase target**：该计划属于哪个 phase（来自 frontmatter 或从内容推断）
- **Plan objectives**：该计划要完成什么
- **Tasks listed**：计划中描述的各个工作项
- **Files modified**：提到的目标文件
- **Dependencies**：引用的前置条件

</step>

<step name="plan_conflict_detection">

针对已加载的项目上下文运行冲突检查。报告格式、严重级别语义和 safety-gate 行为由 `references/doc-conflict-engine.md` 定义，读取并在此应用。Operation noun: `import`。

### BLOCKER checks（任一条都会阻止导入）：

- 计划指向 ROADMAP.md 中不存在的 phase 编号 → [BLOCKER]
- 计划指定的 tech stack 与 PROJECT.md 约束冲突 → [BLOCKER]
- 计划与任意 CONTEXT.md 的 `<decisions>` block 中的锁定决策冲突 → [BLOCKER]
- 计划与 REQUIREMENTS.md 中已有需求冲突 → [BLOCKER]

### WARNING checks（需要用户确认）：

- 计划与 REQUIREMENTS.md 中已有需求覆盖部分重叠 → [WARNING]
- 计划中的 `depends_on` 引用了尚未完成的计划 → [WARNING]
- 计划修改的文件与其他未完成计划重叠 → [WARNING]
- 计划的 phase 编号与 ROADMAP.md 中现有编号冲突 → [WARNING]

### INFO checks（仅提示，无需操作）：

- 计划使用了当前项目 tech stack 中没有的库 → [INFO]
- 计划向 ROADMAP.md 结构新增了一个 phase → [INFO]

按 `references/doc-conflict-engine.md` 中的格式渲染完整的 Conflict Detection Report。

**如果存在任意 [BLOCKER]：**应用参考中的 safety gate，退出且**不要**写入任何文件。存在 blocker 时不写 PLAN.md。

**如果只有 WARNING 和/或 INFO（无 blocker）：**

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对 `AskUserQuestion` 不可用的非 Claude runtime（OpenAI Codex、Gemini CLI 等）是必须的。

通过 AskUserQuestion 使用 approve-revise-abort 模式提问（见 `references/gate-prompts.md`）：
- question: "Review the warnings above. Proceed with import?"
- header: "Approve?"
- options: Approve | Abort

如果用户选择 "Abort"：正常退出，并显示消息 "Import cancelled."。

</step>

<step name="plan_convert">

将导入内容转换为 GSD PLAN.md 格式。

确保 PLAN.md 包含所有必需的 frontmatter 字段：
```yaml
---
phase: "{NN}-{slug}"
plan: "{NN}-{MM}"
type: "feature|refactor|config|test|docs"
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: []
  artifacts: []
---
```

**拒绝源内容中的 PBR 命名约定：**
如果导入计划引用了 PBR 计划命名（例如 `PLAN-01.md`、`plan-01.md`），则在转换时将所有引用重命名为 GSD 的 `{NN}-{MM}-PLAN.md` 约定。

为输出文件名应用 GSD 命名约定：
- 格式：`{NN}-{MM}-PLAN.md`（例如 `04-01-PLAN.md`）
- **绝不**使用 `PLAN-01.md`、`plan-01.md` 或其他格式
- NN = phase 编号（左侧补零），MM = phase 内计划编号（左侧补零）

确定目标目录：
```
.planning/phases/{NN}-{slug}/
```

如果目录不存在，则创建：
```bash
mkdir -p ".planning/phases/{NN}-{slug}/"
```

将 PLAN.md 文件写入目标目录。

</step>

<step name="plan_validate">

将验证委派给 gsd-plan-checker：

```
Task({
  subagent_type: "gsd-plan-checker",
  prompt: "Validate: .planning/phases/{phase}/{plan}-PLAN.md — check frontmatter completeness, task structure, and GSD conventions. Report any issues."
})
```

如果 checker 返回错误：
- 向用户显示错误
- 要求用户在该计划被视为已导入前先解决问题
- 不删除已写入的文件，用户可以手动修复并重新验证

如果 checker 返回 clean：
- 显示：`Plan validation passed`

</step>

<step name="plan_finalize">

更新 `.planning/ROADMAP.md` 以反映新计划：
- 在正确的 phase section 下的 Plans 列表中添加该计划
- 包含计划名称和描述

如果合适，也更新 `.planning/STATE.md`（例如递增 plan 总数）。

提交导入的计划和更新后的文件：
```bash
gsd-sdk query commit "docs({phase}): import plan from {basename FILEPATH}" .planning/phases/{phase}/{plan}-PLAN.md .planning/ROADMAP.md
```

显示完成信息：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

显示：写入的计划文件名、phase 目录、验证结果、后续步骤。

</step>

---

## Anti-Patterns

不要：
- 违反 `references/doc-conflict-engine.md` 中共享的 conflict-engine 契约（不要 markdown table、不要新 severity label、不要绕过 BLOCKER gate）
- 将 PLAN.md 文件写成 `PLAN-01.md` 或 `plan-01.md`，始终使用 `{NN}-{MM}-PLAN.md`
- 使用 `pbr:plan-checker` 或 `pbr:planner`，请使用 `gsd-plan-checker` 和 `gsd-planner`
- 写入 `.planning/.active-skill`，这是 PBR 模式，GSD 没有对应物
- 在任何地方引用 `pbr-tools`、`pbr:` 或 `PLAN-BUILD-RUN`
- 在 blocker 存在时写入任何 PLAN.md 文件，safety gate 必须生效
- 跳过对 `--from` 文件参数的路径校验
