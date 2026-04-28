---
name: gsd:intel
description: 在 `.planning/intel/` 中查询、检查或刷新代码库情报文件
argument-hint: "[query <term>|status|diff|refresh]"
allowed-tools:
  - Read
  - Bash
  - Task
---

**停止，不要读取这个文件。你已经在读取它了。这个提示由 Claude Code 的命令系统注入到你的上下文中。再用 Read 工具读取此文件只会浪费 tokens。请立即开始执行 Step 0。**

## Step 0 -- Banner

**在进行任何工具调用之前**，显示这个横幅：

```
GSD > INTEL
```

然后继续执行 Step 1。

## Step 1 -- Config Gate

直接使用 Read 工具读取 `.planning/config.json`，检查是否启用了 intel。

**不要使用 `gsd-tools config get-value` 命令**，它在 key 缺失时会直接退出。

1. 使用 Read 工具读取 `.planning/config.json`
2. 如果文件不存在：显示下方的禁用提示并**停止**
3. 解析 JSON 内容。检查 `config.intel && config.intel.enabled === true`
4. 如果 `intel.enabled` **没有**显式为 `true`：显示下方的禁用提示并**停止**
5. 如果 `intel.enabled` 为 `true`：继续执行 Step 2

**禁用提示：**

```
GSD > INTEL

Intel system is disabled. To activate:

  gsd-sdk query config-set intel.enabled true

Then run /gsd-intel refresh to build the initial index.
```

---

## Step 2 -- Parse Argument

解析 `$ARGUMENTS` 以确定操作模式：

| Argument | Action |
|----------|--------|
| `query <term>` | 内联执行查询（Step 2a） |
| `status` | 内联执行状态检查（Step 2b） |
| `diff` | 内联执行差异检查（Step 2c） |
| `refresh` | 启动 intel-updater agent（Step 3） |
| 无参数或未知参数 | 显示用法信息 |

**用法信息**（在没有参数或参数无法识别时显示）：

```
GSD > INTEL

Usage: /gsd-intel <mode>

Modes:
  query <term>  Search intel files for a term
  status        Show intel file freshness and staleness
  diff          Show changes since last snapshot
  refresh       Rebuild all intel files from codebase analysis
```

### Step 2a -- Query

运行：

```bash
gsd-sdk query intel.query <term>
```

解析 JSON 输出并展示结果：
- 如果输出包含 `"disabled": true`，显示 Step 1 中的禁用提示并**停止**
- 如果未找到匹配项，显示：`No intel matches for '<term>'. Try /gsd-intel refresh to build the index.`
- 否则，按 intel file 分组显示匹配条目

显示结果后立刻**停止**。不要启动 agent。

### Step 2b -- Status

运行：

```bash
gsd-sdk query intel.status
```

解析 JSON 输出并显示每个 intel file 的：
- 文件名
- 最近一次 `updated_at` 时间戳
- STALE 或 FRESH 状态（超过 24 小时或缺失则为 stale）

显示状态后立刻**停止**。不要启动 agent。

### Step 2c -- Diff

运行：

```bash
gsd-sdk query intel.diff
```

解析 JSON 输出并显示：
- 自上次 snapshot 以来新增的条目
- 自上次 snapshot 以来移除的条目
- 自上次 snapshot 以来变更的条目

如果还没有 snapshot，建议先运行 `refresh`。

显示 diff 后立刻**停止**。不要启动 agent。

---

## Step 3 -- Refresh (Agent Spawn)

启动前显示：

```
GSD > Spawning intel-updater agent to analyze codebase...
```

启动一个 Task：

```
Task(
  description="Refresh codebase intelligence files",
  prompt="You are the gsd-intel-updater agent. Your job is to analyze this codebase and write/update intelligence files in .planning/intel/.

Project root: ${CWD}
Prefer: gsd-sdk query <subcommand> (installed gsd-sdk on PATH). Legacy: node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs

Instructions:
1. Analyze the codebase structure, dependencies, APIs, and architecture
2. Write JSON intel files to .planning/intel/ (stack.json, api-map.json, dependency-graph.json, file-roles.json, arch-decisions.json)
3. Each file must have a _meta object with updated_at timestamp
4. Use `gsd-sdk query intel.extract-exports <file>` to analyze source files
5. Use `gsd-sdk query intel.patch-meta <file>` to update timestamps after writing
6. Use `gsd-sdk query intel.validate` to check your output

When complete, output: ## INTEL UPDATE COMPLETE
If something fails, output: ## INTEL UPDATE FAILED with details."
)
```

等待 agent 完成。

---

## Step 4 -- Post-Refresh Summary

agent 完成后，运行：

```bash
gsd-sdk query intel.status
```

显示一个摘要，包含：
- 哪些 intel files 被写入或更新
- 最近更新时间戳
- intel index 的整体健康状况

---

## Anti-Patterns

1. 不要为 query/status/diff 操作启动 agent，这些都是内联 CLI 调用
2. 不要直接修改 intel files，刷新时由 agent 负责写入
3. 不要跳过 config gate 检查
4. 不要在 config gate 中使用 gsd-tools config get-value CLI，它会在 key 缺失时退出
