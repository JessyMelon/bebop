<purpose>
创建一个隔离的 workspace 目录，其中包含 git repo 副本（worktree 或 clone）以及独立的 `.planning/` 目录。支持多 repo 编排，也支持单 repo 的 feature branch 隔离。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

## 1. Setup

**强制第一步：执行 init 命令：**

```bash
INIT=$(gsd-sdk query init.new-workspace)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON：`default_workspace_base`、`child_repos`、`child_repo_count`、`worktree_available`、`is_git_repo`、`cwd_repo_name`、`project_root`。

## 2. Parse Arguments

从 $ARGUMENTS 提取：
- `--name` → `WORKSPACE_NAME`（必填）
- `--repos` → `REPO_LIST`（逗号分隔的路径或名称）
- `--path` → `TARGET_PATH`（默认值为 `$default_workspace_base/$WORKSPACE_NAME`）
- `--strategy` → `STRATEGY`（默认值为 `worktree`）
- `--branch` → `BRANCH_NAME`（默认值为 `workspace/$WORKSPACE_NAME`）
- `--auto` → 跳过交互式提问

**如果缺少 `--name` 且不是 `--auto`：**

**Text mode（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 `TEXT_MODE` 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。
使用 AskUserQuestion：
- header: `"Workspace Name"`
- question: `"What should this workspace be called?"`
- requireAnswer: true

## 3. 选择 Repos

**如果提供了 `--repos`：** 解析逗号分隔的值。对每个值：
- 如果是绝对路径，直接使用
- 如果是相对路径或名称，则相对于 `$project_root` 解析
- 特殊情况：`.` 表示当前 repo（使用 `$project_root`，名称为 `$cwd_repo_name`）

**如果未提供 `--repos` 且不是 `--auto`：**

**如果 `child_repo_count` > 0：**

展示 child repos 供用户选择：

使用 AskUserQuestion：
- header: `"Select Repos"`
- question: `"Which repos should be included in the workspace?"`
- options: 将 `child_repos` 数组中的每个 child repo 名称列为一个选项
- multiSelect: true

**如果 `child_repo_count` 为 0 且 `is_git_repo` 为 true：**

使用 AskUserQuestion：
- header: `"Current Repo"`
- question: `"No child repos found. Create a workspace with the current repo?"`
- options:
  - `"Yes — create workspace with current repo"` → 使用当前 repo
  - `"Cancel"` → 退出

**如果 `child_repo_count` 为 0 且 `is_git_repo` 为 false：**

报错：
```
No git repos found in the current directory and this is not a git repo.

Run this command from a directory containing git repos, or specify repos explicitly:
  /gsd-new-workspace --name my-workspace --repos /path/to/repo1,/path/to/repo2
```
退出。

**如果使用 `--auto` 且未提供 `--repos`：**

报错：
```
Error: --auto requires --repos to specify which repos to include.

Usage:
  /gsd-new-workspace --name my-workspace --repos repo1,repo2 --auto
```
退出。

## 4. 选择 Strategy

**如果提供了 `--strategy`：** 直接使用（校验：必须是 `worktree` 或 `clone`）。

**如果未提供 `--strategy` 且不是 `--auto`：**

使用 AskUserQuestion：
- header: `"Strategy"`
- question: `"How should repos be copied into the workspace?"`
- options:
  - `"Worktree (recommended) — lightweight, shares .git objects with source repo"` → `worktree`
  - `"Clone — fully independent copy, no connection to source repo"` → `clone`

**如果是 `--auto`：** 默认使用 `worktree`。

## 5. Validate

在创建任何内容之前，先校验：

1. **Target path** — 必须不存在，或为空目录：
```bash
if [ -d "$TARGET_PATH" ] && [ "$(ls -A "$TARGET_PATH" 2>/dev/null)" ]; then
  echo "Error: Target path already exists and is not empty: $TARGET_PATH"
  echo "Choose a different --name or --path."
  exit 1
fi
```

2. **Source repos exist and are git repos** — 对每个 repo 路径：
```bash
if [ ! -d "$REPO_PATH/.git" ]; then
  echo "Error: Not a git repo: $REPO_PATH"
  exit 1
fi
```

3. **Worktree availability** — 如果 strategy 是 `worktree` 且 `worktree_available` 为 false：
```
Error: git is not available. Install git or use --strategy clone.
```

一次性报告所有校验错误，不要一次只报一个。

## 6. 创建 Workspace

```bash
mkdir -p "$TARGET_PATH"
```

### 对每个 repo：

**Worktree strategy：**
```bash
cd "$SOURCE_REPO_PATH"
git worktree add "$TARGET_PATH/$REPO_NAME" -b "$BRANCH_NAME" 2>&1
```

如果 `git worktree add` 因为 branch 已存在而失败，则尝试带时间戳的 branch：
```bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)
git worktree add "$TARGET_PATH/$REPO_NAME" -b "${BRANCH_NAME}-${TIMESTAMP}" 2>&1
```

如果仍然失败，报告错误，并继续处理剩余 repos。

**Clone strategy：**
```bash
git clone "$SOURCE_REPO_PATH" "$TARGET_PATH/$REPO_NAME" 2>&1
cd "$TARGET_PATH/$REPO_NAME"
git checkout -b "$BRANCH_NAME" 2>&1
```

记录结果：哪些 repos 成功，哪些失败，使用了哪个 branch。

## 7. 写入 WORKSPACE.md

将 workspace manifest 写入 `$TARGET_PATH/WORKSPACE.md`：

```markdown
# Workspace: $WORKSPACE_NAME

Created: $DATE
Strategy: $STRATEGY

## Member Repos

| Repo | Source | Branch | Strategy |
|------|--------|--------|----------|
| $REPO_NAME | $SOURCE_PATH | $BRANCH | $STRATEGY |
...for each repo...

## Notes

[Add context about what this workspace is for]
```

## 8. 初始化 `.planning/`

```bash
mkdir -p "$TARGET_PATH/.planning"
```

## 9. 报告与下一步

**如果所有 repos 都成功：**

```
Workspace created: $TARGET_PATH

  Repos: $REPO_COUNT
  Strategy: $STRATEGY
  Branch: $BRANCH_NAME

Next steps:
  cd "$TARGET_PATH"
  /gsd-new-project    # Initialize GSD in the workspace
```

**如果部分 repos 失败：**

```
Workspace created with $SUCCESS_COUNT of $TOTAL_COUNT repos: $TARGET_PATH

  Succeeded: repo1, repo2
  Failed: repo3 (branch already exists), repo4 (not a git repo)

Next steps:
  cd "$TARGET_PATH"
  /gsd-new-project    # Initialize GSD in the workspace
```

**提供是否初始化 GSD 的选项（如果不是 `--auto`）：**

使用 AskUserQuestion：
- header: `"Initialize GSD"`
- question: `"Would you like to initialize a GSD project in the new workspace?"`
- options:
  - `"Yes — run /gsd-new-project"` → 告诉用户先执行 `cd "$TARGET_PATH"`，再运行 `/gsd-new-project`
  - `"No — I'll set it up later"` → 完成

</process>

<success_criteria>
- [ ] 已在目标路径创建 workspace 目录
- [ ] 所有指定 repos 已复制到 workspace（worktree 或 clone）
- [ ] 已写入带有正确 repo 表格的 WORKSPACE.md manifest
- [ ] 已在 workspace 根目录初始化 `.planning/`
- [ ] 已告知用户 workspace 路径和下一步
</success_criteria>
