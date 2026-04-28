<purpose>
列出所有 pending todos，允许选择其中一项，加载该 todo 的完整上下文，并路由到合适的后续动作。
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

从 init JSON 提取：`todo_count`, `todos`, `pending_dir`。

如果 `todo_count` 为 0：
```
No pending todos.

Todos are captured during work sessions with /gsd-add-todo.

---

Would you like to:

1. Continue with current phase (/gsd-progress)
2. Add a todo now (/gsd-add-todo)
```

退出。
</step>

<step name="parse_filter">
检查参数中是否带 area 过滤：
- `/gsd-check-todos` → 显示全部
- `/gsd-check-todos api` → 只显示 area:api
</step>

<step name="list_todos">
使用 init context 中的 `todos` 数组（如果指定了 area，这里已经过滤好）。

解析后按编号列表展示：

```
Pending Todos:

1. Add auth token refresh (api, 2d ago)
2. Fix modal z-index issue (ui, 1d ago)
3. Refactor database connection pool (database, 5h ago)

---

Reply with a number to view details, or:
- `/gsd-check-todos [area]` to filter by area
- `q` to exit
```

将创建时间格式化为相对时间。
</step>

<step name="handle_selection">
等待用户回复一个编号。

如果有效：加载所选 todo 并继续。
如果无效：提示 "Invalid selection. Reply with a number (1-[N]) or `q` to exit."。
</step>

<step name="load_context">
完整读取 todo file。展示：

```
## [title]

**Area:** [area]
**Created:** [date] ([relative time] ago)
**Files:** [list or "None"]

### Problem
[problem section content]

### Solution
[solution section content]
```

如果 `files` 字段有内容，读取并简要概述每个文件。
</step>

<step name="check_roadmap">
检查是否存在 roadmap（可用 init progress，也可直接检查文件是否存在）：

如果 `.planning/ROADMAP.md` 存在：
1. 检查 todo 的 area 是否匹配某个即将到来的 phase
2. 检查 todo 的 files 是否与某个 phase 的 scope 重叠
3. 将任何匹配用于后续 action 选项
</step>

<step name="offer_actions">
**如果 todo 映射到某个 roadmap phase：**


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 设置 `TEXT_MODE=true`：如果 `--text` 出现在 `$ARGUMENTS` 中，或 init JSON 中的 `text_mode` 为 `true`。当 TEXT_MODE is active 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。
使用 AskUserQuestion：
- header: "Action"
- question: "This todo relates to Phase [N]: [name]. What would you like to do?"
- options:
  - "Work on it now" — 移到 done，开始处理
  - "Add to phase plan" — 在规划 Phase [N] 时纳入
  - "Brainstorm approach" — 先想清楚再决定
  - "Put it back" — 返回列表

**如果没有 roadmap 匹配：**

使用 AskUserQuestion：
- header: "Action"
- question: "What would you like to do with this todo?"
- options:
  - "Work on it now" — 移到 done，开始处理
  - "Create a phase" — /gsd-add-phase with this scope
  - "Brainstorm approach" — 先想清楚再决定
  - "Put it back" — 返回列表
</step>

<step name="execute_action">
**Work on it now：**
```bash
mv ".planning/todos/pending/[filename]" ".planning/todos/completed/"
```
更新 STATE.md 中的 todo 计数。展示 problem/solution 上下文。开始工作，或询问如何继续。

**Add to phase plan：**
在 phase planning notes 中记录该 todo 引用。保持为 pending。返回列表或退出。

**Create a phase：**
显示：`/gsd-add-phase [description from todo]`
保持为 pending。用户在新上下文中运行该命令。

**Brainstorm approach：**
保持为 pending。开始讨论问题和处理思路。

**Put it back：**
返回 list_todos 步骤。
</step>

<step name="update_state">
任何会改变 todo 计数的操作后：

重新运行 `init todos` 获取最新计数，然后更新 STATE.md 中的 "### Pending Todos" 小节（如果存在）。
</step>

<step name="git_commit">
如果 todo 已移动到 done/，提交该变更：

```bash
git rm --cached .planning/todos/pending/[filename] 2>/dev/null || true
gsd-sdk query commit "docs: start work on todo - [title]" .planning/todos/completed/[filename] .planning/STATE.md
```

该工具会自动遵守 `commit_docs` 配置和 gitignore。

确认："Committed: docs: start work on todo - [title]"
</step>

</process>

<success_criteria>
- [ ] 已列出全部 pending todos，包含 title、area、age
- [ ] 若指定 area，已正确过滤
- [ ] 已加载所选 todo 的完整上下文
- [ ] 已检查 roadmap 上下文以寻找 phase 匹配
- [ ] 已提供合适的 action 选项
- [ ] 已执行所选 action
- [ ] 如果 todo 计数变化，STATE.md 已更新
- [ ] 如果 todo 被移到 done/，变更已提交到 git
</success_criteria>
