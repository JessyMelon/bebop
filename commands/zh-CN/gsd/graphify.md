---
name: gsd:graphify
description: 在 `.planning/graphs/` 中构建、查询和检查项目知识图谱
argument-hint: "[build|query <term>|status|diff]"
allowed-tools:
  - Read
  - Bash
  - Task
---

**停止，不要读取这个文件。你已经在读取它了。这个提示由 Claude Code 的命令系统注入到你的上下文中。再用 Read 工具读取此文件只会浪费 tokens。请立即开始执行 Step 0。**

**仅限 CJS（graphify）：** `graphify` 子命令未注册到 `gsd-sdk query`。请按本命令和 `docs/CLI-TOOLS.md` 中的说明使用 `node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify …`。其他工具若存在 handler，仍可使用 `gsd-sdk query`。

## Step 0 -- Banner

**在进行任何工具调用之前**，显示这个横幅：

```
GSD > GRAPHIFY
```

然后继续执行 Step 1。

## Step 1 -- Config Gate

直接使用 Read 工具读取 `.planning/config.json`，检查是否启用了 graphify。

**不要使用 `gsd-tools config get-value` 命令**，它在 key 缺失时会直接退出。

1. 使用 Read 工具读取 `.planning/config.json`
2. 如果文件不存在：显示下方的禁用提示并**停止**
3. 解析 JSON 内容。检查 `config.graphify && config.graphify.enabled === true`
4. 如果 `graphify.enabled` **没有**显式为 `true`：显示下方的禁用提示并**停止**
5. 如果 `graphify.enabled` 为 `true`：继续执行 Step 2

**禁用提示：**

```
GSD > GRAPHIFY

Knowledge graph is disabled. To activate:

  node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs config-set graphify.enabled true

Then run /gsd-graphify build to create the initial graph.
```

---

## Step 2 -- Parse Argument

解析 `$ARGUMENTS` 以确定操作模式：

| Argument | Action |
|----------|--------|
| `build` | 启动 graphify-builder agent（Step 3） |
| `query <term>` | 内联执行查询（Step 2a） |
| `status` | 内联执行状态检查（Step 2b） |
| `diff` | 内联执行差异检查（Step 2c） |
| 无参数或未知参数 | 显示用法信息 |

**用法信息**（在没有参数或参数无法识别时显示）：

```
GSD > GRAPHIFY

Usage: /gsd-graphify <mode>

Modes:
  build           Build or rebuild the knowledge graph
  query <term>    Search the graph for a term
  status          Show graph freshness and statistics
  diff            Show changes since last build
```

### Step 2a -- Query

运行：

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify query <term>
```

解析 JSON 输出并展示结果：
- 如果输出包含 `"disabled": true`，显示 Step 1 中的禁用提示并**停止**
- 如果输出包含 `"error"` 字段，显示错误信息并**停止**
- 如果未找到节点，显示：`No graph matches for '<term>'. Try /gsd-graphify build to create or rebuild the graph.`
- 否则，按类型分组显示匹配节点，并展示边关系与置信度层级（EXTRACTED/INFERRED/AMBIGUOUS）

显示结果后立刻**停止**。不要启动 agent。

### Step 2b -- Status

运行：

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify status
```

解析 JSON 输出并显示：
- 如果 `exists: false`，显示 `message` 字段
- 否则显示最近构建时间、node/edge/hyperedge 数量，以及 STALE 或 FRESH 标记

显示状态后立刻**停止**。不要启动 agent。

### Step 2c -- Diff

运行：

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify diff
```

解析 JSON 输出并显示：
- 如果 `no_baseline: true`，显示 `message` 字段
- 否则显示 node 和 edge 的变化数量（added/removed/changed）

如果还不存在 snapshot，建议先运行两次 `build`（第一次创建，第二次生成 diff baseline）。

显示 diff 后立刻**停止**。不要启动 agent。

---

## Step 3 -- Build (Agent Spawn)

先运行预检查：

```
PREFLIGHT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" graphify build)
```

如果预检查返回 `disabled: true` 或 `error`，显示对应信息并**停止**。

如果预检查返回 `action: "spawn_agent"`，显示：

```
GSD > Spawning graphify-builder agent...
```

启动一个 Task：

```
Task(
  description="Build or rebuild the project knowledge graph",
  prompt="You are the graphify-builder agent. Your job is to build or rebuild the project knowledge graph using the graphify CLI.

Project root: ${CWD}
gsd-tools path: $HOME/.claude/get-shit-done/bin/gsd-tools.cjs

## Instructions

1. **Invoke graphify:**
   Run from the project root:
   ```
   graphify . --update
   ```
   This builds the knowledge graph with SHA256 incremental caching.
   Timeout: up to 5 minutes (or as configured via graphify.build_timeout).

2. **Validate output:**
   Check that graphify-out/graph.json exists and is valid JSON with nodes[] and edges[] arrays.
   If graphify exited non-zero or graph.json is not parseable, output:
   ## GRAPHIFY BUILD FAILED
   Include the stderr output for debugging. Do NOT delete .planning/graphs/ -- prior valid graph remains available.

3. **Copy artifacts to .planning/graphs/:**
   ```
   cp graphify-out/graph.json .planning/graphs/graph.json
   cp graphify-out/graph.html .planning/graphs/graph.html
   cp graphify-out/GRAPH_REPORT.md .planning/graphs/GRAPH_REPORT.md
   ```
   These three files are the build output consumed by query, status, and diff commands.

4. **Write diff snapshot:**
   ```
   node \"$HOME/.claude/get-shit-done/bin/gsd-tools.cjs\" graphify build snapshot
   ```
   This creates .planning/graphs/.last-build-snapshot.json for future diff comparisons.

5. **Report build summary:**
   ```
   node \"$HOME/.claude/get-shit-done/bin/gsd-tools.cjs\" graphify status
   ```
   Display the node count, edge count, and hyperedge count from the status output.

When complete, output: ## GRAPHIFY BUILD COMPLETE with the summary counts.
If something fails at any step, output: ## GRAPHIFY BUILD FAILED with details."
)
```

等待 agent 完成。

---

## Anti-Patterns

1. 不要为 query/status/diff 操作启动 agent，这些都是内联 CLI 调用
2. 不要直接修改 graph 文件，由 build agent 负责写入
3. 不要跳过 config gate 检查
4. 不要在 config gate 中使用 gsd-tools config get-value，它会在 key 缺失时退出
