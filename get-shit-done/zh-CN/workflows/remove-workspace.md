<purpose>
移除一个 GSD workspace，清理 git worktree 并删除 workspace 目录。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<process>

## 1. Setup

从 $ARGUMENTS 提取 workspace 名称。

```bash
INIT=$(gsd-sdk query init.remove-workspace "$WORKSPACE_NAME")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，提取：`workspace_name`, `workspace_path`, `has_manifest`, `strategy`, `repos`, `repo_count`, `dirty_repos`, `has_dirty_repos`。

**如果未提供 workspace 名称：**

先运行 `/gsd-list-workspaces` 显示可用的 workspaces，然后询问：


**文本模式（配置中 `workflow.text_mode: true` 或传入 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，把每次 `AskUserQuestion` 调用改为纯文本编号列表，并让用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）在没有 `AskUserQuestion` 时的必需行为。
使用 AskUserQuestion：
- header: "Remove Workspace"
- question: "你想移除哪个 workspace？"
- requireAnswer: true

使用提供的名称重新运行 init。

## 2. Safety Checks

**如果 `has_dirty_repos` 为 true：**

```
无法移除 workspace "$WORKSPACE_NAME" — 以下 repos 有未提交的变更：

  - repo1
  - repo2

移除 workspace 前，请先在这些 repos 中提交或暂存变更：
  cd "$WORKSPACE_PATH/repo1"
  git stash   # or git commit
```

退出。不要继续。

## 3. Confirm Removal

使用 AskUserQuestion：
- header: "Confirm Removal"
- question: "要移除位于 $WORKSPACE_PATH 的 workspace '$WORKSPACE_NAME' 吗？这会删除 workspace 目录中的所有文件。请输入 workspace 名称以确认："
- requireAnswer: true

**如果回答与 `$WORKSPACE_NAME` 不一致：** 以 "已取消移除。" 退出。

## 4. Clean Up Worktrees

**如果 strategy 是 `worktree`：**

对 workspace 中的每个 repo：

```bash
cd "$SOURCE_REPO_PATH"
git worktree remove "$WORKSPACE_PATH/$REPO_NAME" 2>&1 || true
```

如果 `git worktree remove` 失败，给出警告但继续：
```
Warning: 无法移除 $REPO_NAME 的 worktree — source repo 可能已被移动或删除。
```

## 5. Delete Workspace Directory

```bash
rm -rf "$WORKSPACE_PATH"
```

## 6. Report

```
Workspace "$WORKSPACE_NAME" 已移除。

  Path: $WORKSPACE_PATH（已删除）
  Repos: 已清理 $REPO_COUNT 个 worktree
```

</process>
