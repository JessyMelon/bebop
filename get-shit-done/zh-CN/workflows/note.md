<purpose>
零摩擦记录想法。一次 Write 调用，一行确认。不要提问，不要 prompt。

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对无法使用 `AskUserQuestion` 的非-Claude runtime（OpenAI Codex、Gemini CLI 等）是必需的。
内联运行——不使用 Task、不使用 AskUserQuestion、不使用 Bash。
</purpose>

<required_reading>
开始前读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<process>

<step name="storage_format">
**Note 存储格式。**

Notes 以单独的 markdown 文件存储：

- **Project scope**: `.planning/notes/{YYYY-MM-DD}-{slug}.md` — 当 cwd 中存在 `.planning/` 时使用
- **Global scope**: `~/.claude/notes/{YYYY-MM-DD}-{slug}.md` — 当不存在 `.planning/` 时回退到此处，或在存在 `--global` flag 时使用

每个 note 文件：

```markdown
---
date: "YYYY-MM-DD HH:mm"
promoted: false
---

{note text verbatim}
```

**`--global` flag**: 在解析前，从 `$ARGUMENTS` 的任意位置剥离 `--global`。存在时，无论 `.planning/` 是否存在，都强制使用 global scope。

**Important**: 如果 `.planning/` 不存在，不要创建它。静默回退到 global scope。
</step>

<step name="parse_subcommand">
**从 $ARGUMENTS 解析 subcommand（剥离 `--global` 之后）。**

| Condition | Subcommand |
|-----------|------------|
| 参数严格等于 `list`（不区分大小写） | **list** |
| 参数严格等于 `promote <N>`，其中 N 是数字 | **promote** |
| 参数为空（完全没有文本） | **list** |
| 其他任何情况 | **append**（该文本就是 note） |

**Critical**: `list` 只有在它是完整参数时才算 subcommand。`/gsd-note list of groceries` 会保存一条文本为 "list of groceries" 的 note。`promote` 也一样——只有后面严格跟一个数字时才算 subcommand。
</step>

<step name="append">
**Subcommand: append — 创建带时间戳的 note 文件。**

1. 按上面的存储格式确定 scope（project 或 global）
2. 确保 notes 目录存在（`.planning/notes/` 或 `~/.claude/notes/`）
3. 生成 slug：取 note 文本前约 4 个有意义的词，小写，用连字符连接（去掉开头的冠词/介词）
4. 生成文件名：`{YYYY-MM-DD}-{slug}.md`
   - 如果该文件名已存在，则追加 `-2`、`-3` 等
5. 用 frontmatter 和 note 文本写入文件（见存储格式）
6. 仅用一行确认：`Noted ({scope}): {note text}`
   - 其中 `{scope}` 为 "project" 或 "global"

**Constraints:**
- **Never modify the note text** — 按原样记录，包括拼写错误
- **Never ask questions** — 直接写入并确认
- **Timestamp format**: 使用本地时间，`YYYY-MM-DD HH:mm`（24 小时制，无秒）
</step>

<step name="list">
**Subcommand: list — 显示两个 scope 中的 notes。**

1. Glob `.planning/notes/*.md`（如果目录存在）— project notes
2. Glob `~/.claude/notes/*.md`（如果目录存在）— global notes
3. 对每个文件，读取 frontmatter 获取 `date` 和 `promoted` 状态
4. 在 active 计数中排除 `promoted: true` 的文件（但仍要显示，且使用 dimmed 样式）
5. 按日期排序，对所有 active 条目从 1 开始连续编号
6. 如果 active 条目总数 > 20，只显示最后 10 条，并说明省略了多少条

**Display format:**

```
Notes:

Project (.planning/notes/):
  1. [2026-02-08 14:32] refactor the hook system to support async validators
  2. [promoted] [2026-02-08 14:40] add rate limiting to the API endpoints
  3. [2026-02-08 15:10] consider adding a --dry-run flag to build

Global (~/.claude/notes/):
  4. [2026-02-08 10:00] cross-project idea about shared config

{count} active note(s). Use `/gsd-note promote <N>` to convert to a todo.
```

如果某个 scope 没有目录或没有条目，显示：`(no notes)`
</step>

<step name="promote">
**Subcommand: promote — 将 note 转换为 todo。**

1. 运行 **list** 逻辑，构建编号索引（两个 scope 一起）
2. 从编号列表中找到第 N 项
3. 如果 N 无效，或指向已经 promoted 的 note，告知用户并停止
4. **Requires `.planning/` directory** — 如果不存在，则警告："Todos require a GSD project. Run `/gsd-new-project` to initialize one."
5. 确保 `.planning/todos/pending/` 目录存在
6. 生成 todo ID：`{NNN}-{slug}`，其中 NNN 是下一个顺序编号（扫描 `.planning/todos/pending/` 和 `.planning/todos/completed/` 中现有的最高编号，加 1，并补零为 3 位），slug 取 note 文本前约 4 个有意义的词
7. 从源文件中提取 note 文本（frontmatter 后的正文）
8. 创建 `.planning/todos/pending/{id}.md`：

```yaml
---
title: "{note text}"
status: pending
priority: P2
source: "promoted from /gsd-note"
created: {YYYY-MM-DD}
theme: general
---

## Goal

{note text}

## Context

Promoted from quick note captured on {original date}.

## Acceptance Criteria

- [ ] {primary criterion derived from note text}
```

9. 将源 note 文件标记为 promoted：把它的 frontmatter 更新为 `promoted: true`
10. 确认：`Promoted note {N} to todo {id}: {note text}`
</step>

</process>

<edge_cases>
1. **"list" as note text**: `/gsd-note list of things` 会保存 note "list of things"（只有当 `list` 是完整参数时才是 subcommand）
2. **No `.planning/`**: 回退到全局 `~/.claude/notes/` —— 在任何目录都可用
3. **Promote without project**: 警告 todos 需要 `.planning/`，并提示 `/gsd-new-project`
4. **Large files**: 当 active 条目 >20 时，`list` 只显示最后 10 条
5. **Duplicate slugs**: 如果同一天该 slug 已被使用，则在文件名后追加 `-2`、`-3` 等
6. **`--global` position**: 可从任意位置剥离 —— `--global my idea` 和 `my idea --global` 都会将 "my idea" 保存到全局
7. **Promote already-promoted**: 告诉用户 "Note {N} is already promoted" 并停止
8. **Empty note text after stripping flags**: 按 `list` subcommand 处理
</edge_cases>

<success_criteria>
- [ ] Append: Note 文件写入正确的 frontmatter 和原样文本
- [ ] Append: 不提问——即时记录
- [ ] List: 两个 scope 都显示，并连续编号
- [ ] List: Promoted notes 会显示，但为 dimmed 状态
- [ ] Promote: Todo 使用正确格式创建
- [ ] Promote: 源 note 被标记为 promoted
- [ ] Global fallback: 在不存在 `.planning/` 时也能工作
</success_criteria>
