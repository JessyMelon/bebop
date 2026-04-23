# 手动更新（非 npm 安装）

当 `npx get-shit-done-cc@latest` 不可用时使用此流程，例如发布故障期间，或者你正在直接从源码仓库工作时。

## 前提条件

- 已安装 Node.js
- 此仓库已在本地克隆（`git clone https://github.com/gsd-build/get-shit-done`）

## 步骤

```bash
# 1. 拉取最新代码
git pull --rebase origin main

# 2. 构建 hooks 的 dist（必需 - hooks/dist/ 是生成物，不是源码）
node scripts/build-hooks.js

# 3. 直接运行安装程序
node bin/install.js --claude --global

# 4. 清除更新缓存，让状态栏提示重置
rm -f ~/.cache/gsd/gsd-update-check.json
```

**第 5 步 - 重启你的运行时**，以加载新的命令和代理。

## 运行时标志

将 `--claude` 替换为你的运行时对应标志：

| 运行时 | 标志 |
|---|---|
| Claude Code | `--claude` |
| Gemini CLI | `--gemini` |
| OpenCode | `--opencode` |
| Kilo | `--kilo` |
| Codex | `--codex` |
| Copilot | `--copilot` |
| Cursor | `--cursor` |
| Windsurf | `--windsurf` |
| Augment | `--augment` |
| 所有运行时 | `--all` |

使用 `--local` 代替 `--global`，即可进行项目级安装。

## 安装程序会替换什么

安装程序只会对 GSD 管理的目录执行清理式覆盖：

- `~/.claude/get-shit-done/` - 工作流、引用、模板
- `~/.claude/commands/gsd/` - slash 命令
- `~/.claude/agents/gsd-*.md` - GSD 代理
- `~/.claude/hooks/dist/` - 编译后的 hooks

**会保留的内容：**
- 不以 `gsd-` 开头的自定义代理
- `commands/gsd/` 之外的自定义命令
- 你的 `CLAUDE.md` 文件
- 自定义 hooks

本地修改过的 GSD 文件会在安装前自动备份到 `gsd-local-patches/`。更新后运行 `/gsd-reapply-patches`，把你的修改合并回来。
