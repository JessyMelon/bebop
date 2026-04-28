# Git 规划提交

通过 `gsd-sdk query commit` 提交规划工件，它会检查 `commit_docs` 配置与 gitignore 状态（与旧版 `gsd-tools.cjs commit` 行为一致）。

## Commit via CLI

先传 message，再传文件路径（位置参数）。`commit` 不要用 `--files`（该 flag 只用于 `commit-to-subrepo`）。

对 `.planning/` 文件始终使用这种方式 —— 它会自动处理 `commit_docs` 和 gitignore 检查：

```bash
gsd-sdk query commit "docs({scope}): {description}" .planning/STATE.md .planning/ROADMAP.md
```

如果 `commit_docs` 为 `false` 或 `.planning/` 被 gitignored，CLI 会返回 `skipped`（附带原因）。不需要手动写条件判断。

## Amend previous commit

要把 `.planning/` 文件变更折叠进上一个 commit：

```bash
gsd-sdk query commit "" .planning/codebase/*.md --amend
```

## Commit Message Patterns

| Command | Scope | Example |
|---------|-------|---------|
| plan-phase | phase | `docs(phase-03): create authentication plans` |
| execute-phase | phase | `docs(phase-03): complete authentication phase` |
| new-milestone | milestone | `docs: start milestone v1.1` |
| remove-phase | chore | `chore: remove phase 17 (dashboard)` |
| insert-phase | phase | `docs: insert phase 16.1 (critical fix)` |
| add-phase | phase | `docs: add phase 07 (settings page)` |

## When to Skip

- config 中 `commit_docs: false`
- `.planning/` 被 gitignored
- 没有变更可提交（用 `git status --porcelain .planning/` 检查）
