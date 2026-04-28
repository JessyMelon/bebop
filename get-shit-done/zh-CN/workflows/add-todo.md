<purpose>
把 GSD 会话中出现的想法、任务或问题记录为结构化 todo，留待后续处理。实现“想到 → 记录 → 继续”的流转，不丢上下文。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="init_context">
加载 todo 上下文：

```bash
INIT=$(gsd-sdk query init.todos)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 提取：`commit_docs`, `date`, `timestamp`, `todo_count`, `todos`, `pending_dir`, `todos_dir_exists`。

确保目录存在：
```bash
mkdir -p .planning/todos/pending .planning/todos/completed
```

在 infer_area 步骤中，参考 todos 数组里的已有 area，保持一致性。
</step>

<step name="extract_content">
**带参数时：** 将参数作为标题/焦点。
- `/gsd-add-todo Add auth token refresh` → title = "Add auth token refresh"

**不带参数时：** 分析最近对话，提取：
- 讨论中的具体问题、想法或任务
- 提到的相关文件路径
- 技术细节（错误信息、行号、约束）

整理出：
- `title`：3-10 个词的描述性标题（优先用动作动词）
- `problem`：问题是什么，或为什么需要它
- `solution`：处理思路提示；若只是想法则写 "TBD"
- `files`：对话中相关路径及行号
</step>

<step name="infer_area">
根据文件路径推断 area：

| Path pattern | Area |
|--------------|------|
| `src/api/*`, `api/*` | `api` |
| `src/components/*`, `src/ui/*` | `ui` |
| `src/auth/*`, `auth/*` | `auth` |
| `src/db/*`, `database/*` | `database` |
| `tests/*`, `__tests__/*` | `testing` |
| `docs/*` | `docs` |
| `.planning/*` | `planning` |
| `scripts/*`, `bin/*` | `tooling` |
| 无文件或不明确 | `general` |

如果第 2 步已有相近匹配，则沿用现有 area。
</step>

<step name="check_duplicates">
```bash
# Search for key words from title in existing todos
grep -l -i "[key words from title]" .planning/todos/pending/*.md 2>/dev/null || true
```

如果发现潜在重复项：
1. 读取已有 todo
2. 比较范围


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 设置 `TEXT_MODE=true`：如果 `--text` 出现在 `$ARGUMENTS` 中，或 init JSON 中的 `text_mode` 为 `true`。当 TEXT_MODE is active 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。
如果范围重叠，使用 AskUserQuestion：
- header: "Duplicate?"
- question: "Similar todo exists: [title]. What would you like to do?"
- options:
  - "Skip" — 保留现有 todo
  - "Replace" — 用新上下文更新现有项
  - "Add anyway" — 仍然创建为独立 todo
</step>

<step name="create_file">
使用 init context 中的值：`timestamp` 和 `date` 已可直接使用。

为 title 生成 slug：
```bash
slug=$(gsd-sdk query generate-slug "$title" --raw)
```

写入 `.planning/todos/pending/${date}-${slug}.md`：

```markdown
---
created: [timestamp]
title: [title]
area: [area]
files:
  - [file:lines]
---

## Problem

[problem description - enough context for future Claude to understand weeks later]

## Solution

[approach hints or "TBD"]
```
</step>

<step name="update_state">
如果 `.planning/STATE.md` 存在：

1. 使用 init context 中的 `todo_count`（如果数量变化，可重新运行 `init todos`）
2. 更新 "## Accumulated Context" 下的 "### Pending Todos"
</step>

<step name="git_commit">
提交该 todo 以及所有更新后的 state：

```bash
gsd-sdk query commit "docs: capture todo - [title]" .planning/todos/pending/[filename] .planning/STATE.md
```

该工具会自动遵守 `commit_docs` 配置和 gitignore。

确认："Committed: docs: capture todo - [title]"
</step>

<step name="confirm">
```
Todo saved: .planning/todos/pending/[filename]

  [title]
  Area: [area]
  Files: [count] referenced

---

Would you like to:

1. Continue with current work
2. Add another todo
3. View all todos (/gsd-check-todos)
```
</step>

</process>

<success_criteria>
- [ ] 目录结构存在
- [ ] 已创建带有效 frontmatter 的 todo file
- [ ] Problem 小节为未来的 Claude 提供了足够上下文
- [ ] 无重复项（已检查并处理）
- [ ] Area 与现有 todos 保持一致
- [ ] 如果存在，STATE.md 已更新
- [ ] Todo 和 state 已提交到 git
</success_criteria>
