<purpose>
列出在 `~/gsd-workspaces/` 中找到的所有 GSD workspace 及其状态。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

## 1. Setup

```bash
INIT=$(gsd-sdk query init.list-workspaces)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，获取：`workspace_base`、`workspaces`、`workspace_count`。

## 2. Display

**如果 `workspace_count` 为 0：**

```
No workspaces found in ~/gsd-workspaces/

Create one with:
  /gsd-new-workspace --name my-workspace --repos repo1,repo2
```

结束。

**如果存在 workspace：**

显示表格：

```
GSD Workspaces (~/gsd-workspaces/)

| Name | Repos | Strategy | GSD Project |
|------|-------|----------|-------------|
| feature-a | 3 | worktree | Yes |
| feature-b | 2 | clone | No |

Manage:
  cd ~/gsd-workspaces/<name>     # Enter a workspace
  /gsd-remove-workspace <name>   # Remove a workspace
```

对每个 workspace，显示：
- **Name** — 目录名
- **Repos** — 来自 init 数据的数量
- **Strategy** — 来自 WORKSPACE.md
- **GSD Project** — `.planning/PROJECT.md` 是否存在（Yes/No）

</process>
