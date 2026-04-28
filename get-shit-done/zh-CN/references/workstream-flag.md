# Workstream 标志（`--ws`）

## 概览

`--ws <name>` 标志用于把 GSD 操作限定到某个特定 workstream，使多个 Claude Code 实例能够在同一代码库上并行推进 milestone 工作。

## 解析优先级

1. `--ws <name>` 标志（显式，最高优先级）
2. `GSD_WORKSTREAM` 环境变量（每实例）
3. temp 存储中的会话作用域 active workstream 指针（每次运行会话 / terminal）
4. `.planning/active-workstream` 文件（当不存在会话键时的旧版共享回退）
5. `null`，即 flat mode（无 workstream）

## 为什么需要会话作用域指针

共享的 `.planning/active-workstream` 文件在同一 repo 上有多个 Claude/Codex 实例同时运行时，本质上是不安全的。一个会话可以在无提示的情况下重定向另一个会话的 `STATE.md`、`ROADMAP.md` 和 phase 路径。

现在 GSD 更倾向使用按运行时/会话身份做键控的会话作用域指针（`GSD_SESSION_KEY`、`CODEX_THREAD_ID`、`CLAUDE_CODE_SSE_PORT`、terminal session ID 或控制 TTY）。这样既能隔离并发会话，也保留了对无法提供稳定会话键的运行时的旧版兼容性。

## 会话身份解析

当 GSD 在上文第 3 步解析会话作用域指针时，会按以下顺序处理：

1. 显式的运行时/会话环境变量，例如 `GSD_SESSION_KEY`、`CODEX_THREAD_ID`、`CLAUDE_SESSION_ID`、`CLAUDE_CODE_SSE_PORT`、`OPENCODE_SESSION_ID`、`GEMINI_SESSION_ID`、`CURSOR_SESSION_ID`、`WINDSURF_SESSION_ID`、`TERM_SESSION_ID`、`WT_SESSION`、`TMUX_PANE` 和 `ZELLIJ_SESSION_NAME`
2. `TTY` 或 `SSH_TTY`，如果 shell/运行时已经暴露了 terminal 路径
3. 单次尽力而为的 `tty` 探测，但仅在 stdin 可交互时进行

如果这些都无法产生稳定身份，GSD 就不会继续探测，而是直接回退到旧版共享 `.planning/active-workstream` 文件。

这在无头或被裁剪的环境中很重要：当 stdin 已经不可交互时，GSD 会有意跳过对 `tty` 的 shell 调用，因为那种路径无法发现稳定的会话身份，只会在路由热路径上增加可避免的失败。

## 指针生命周期

会话作用域指针被有意设计成轻量且尽力而为：

- 为某个会话清除 workstream 时，只会删除该会话自己的指针文件
- 如果这是该 repo 的最后一个指针，GSD 还会删除对应的、此时已为空的项目级 temp 目录
- 如果仍有同级会话指针存在，则保留该 temp 目录
- 当某个指针引用的 workstream 目录已不存在时，GSD 会将其视为陈旧状态：删除该指针文件，并解析为 `null`，直到该会话再次显式设置新的 active workstream

GSD 目前不会为历史 temp 目录运行后台垃圾回收。清理只会在指针被清除或自愈时机会性发生，更广泛的 temp 卫生则留给操作系统的 temp 清理或后续维护工作。

## 路由传播

所有工作流路由命令都会包含 `${GSD_WS}`，其含义是：
- 当 workstream 处于激活状态时，展开为 `--ws <name>`
- 在 flat mode 下展开为空字符串（向后兼容）

这可确保 workstream 作用域会沿整个工作流自动传递：
`new-milestone → discuss-phase → plan-phase → execute-phase → transition`

## 目录结构

```
.planning/
├── PROJECT.md          # Shared
├── config.json         # Shared
├── milestones/         # Shared
├── codebase/           # Shared
├── active-workstream   # Legacy shared fallback only
└── workstreams/
    ├── feature-a/      # Workstream A
    │   ├── STATE.md
    │   ├── ROADMAP.md
    │   ├── REQUIREMENTS.md
    │   └── phases/
    └── feature-b/      # Workstream B
        ├── STATE.md
        ├── ROADMAP.md
        ├── REQUIREMENTS.md
        └── phases/
```

## CLI 用法

```bash
# All gsd-sdk query commands accept --ws
gsd-sdk query state.json --ws feature-a
gsd-sdk query find-phase 3 --ws feature-b

# Session-local switching without --ws on every command
GSD_SESSION_KEY=my-terminal-a gsd-sdk query workstream.set feature-a
GSD_SESSION_KEY=my-terminal-a gsd-sdk query state.json
GSD_SESSION_KEY=my-terminal-b gsd-sdk query workstream.set feature-b
GSD_SESSION_KEY=my-terminal-b gsd-sdk query state.json

# Workstream CRUD
gsd-sdk query workstream.create <name>
gsd-sdk query workstream.list
gsd-sdk query workstream.status <name>
gsd-sdk query workstream.complete <name>
```
