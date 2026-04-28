<purpose>
轻量级 codebase 评估。为一个 focus area 启动单个 gsd-codebase-mapper agent，
在 `.planning/codebase/` 中生成有针对性的文档。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-codebase-mapper — 映射项目结构与依赖关系
</available_agent_types>

<process>

## Focus-to-Document Mapping

| Focus | Documents Produced |
|-------|-------------------|
| `tech` | STACK.md, INTEGRATIONS.md |
| `arch` | ARCHITECTURE.md, STRUCTURE.md |
| `quality` | CONVENTIONS.md, TESTING.md |
| `concerns` | CONCERNS.md |
| `tech+arch` | STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md |

## Step 1: Parse arguments and resolve focus

从用户输入中解析 `--focus <area>`。如果未指定，默认使用 `tech+arch`。

验证 focus 是否为以下之一：`tech`, `arch`, `quality`, `concerns`, `tech+arch`。

如果无效：
```
未知的 focus area: "{input}"。有效选项：tech, arch, quality, concerns, tech+arch
```
退出。

## Step 2: Check for existing documents

```bash
INIT=$(gsd-sdk query init.map-codebase 2>/dev/null || echo "{}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

根据上方映射表，查出所选 focus 会产出哪些文档。

对每个目标文档，检查它是否已存在于 `.planning/codebase/`：
```bash
ls -la .planning/codebase/{DOCUMENT}.md 2>/dev/null
```

如果有任意文档存在，显示它们的修改日期并询问：
```
发现现有文档：
  - STACK.md（modified 2026-04-03）
  - INTEGRATIONS.md（modified 2026-04-01）

要用新的扫描结果覆盖吗？[y/N]
```

如果用户回答 no，退出。

## Step 3: Create output directory

```bash
mkdir -p .planning/codebase
```

## Step 4: Spawn mapper agent

为所选 focus area 启动单个 `gsd-codebase-mapper` agent：

```
Task(
  prompt="扫描这个 codebase，focus: {focus}。将结果写入 .planning/codebase/。只产出：{document_list}",
  subagent_type="gsd-codebase-mapper",
  model="{resolved_model}"
)
```

## Step 5: Report

```
## 扫描完成

**Focus:** {focus}
**产出文档：**
{list of documents written with line counts}

使用 `/gsd-map-codebase` 可执行全面的 4-area 并行扫描。
```

</process>

<success_criteria>
- [ ] 已正确解析 focus area（默认：tech+arch）
- [ ] 已检测现有文档并显示修改日期
- [ ] 已在覆盖前提示用户
- [ ] 已按正确 focus 启动单个 mapper agent
- [ ] 已将输出文档写入 .planning/codebase/
</success_criteria>
