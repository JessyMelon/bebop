---
name: gsd:map-codebase
description: 使用并行 mapper agents 分析代码库，生成 `.planning/codebase/` 文档
argument-hint: "[area] [--repos repo-a,repo-b] [--refresh-scope]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - Task
---

<objective>
使用并行的 gsd-codebase-mapper agents 分析现有代码库，生成结构化的 codebase 文档。

每个 mapper agent 探索一个关注领域，并**直接写入文档**到 `.planning/codebase/`。编排器只接收完成确认，从而尽量减少上下文占用。

输出：`.planning/codebase/` 目录，其中包含 7 份描述代码库状态的结构化文档。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/map-codebase.md
</execution_context>

<context>
Arguments：$ARGUMENTS

支持的范围：
- 无参数：完整分析当前 workspace
- `<area>`：按子系统/领域聚焦分析，如 `api`、`auth`
- `--repos <repo-a,repo-b>`：只更新指定仓库对应的 `.planning/codebase/` 内容，并保留已有分析
- 多个裸 repo 参数：如果所有参数都能匹配已配置或本地存在的 repo，则按 repo 范围处理

**如果存在则加载项目状态：**
检查 `.planning/STATE.md`，如果项目已初始化则加载上下文

**此命令可在以下场景运行：**
- 在 `/gsd-new-project` 之前（brownfield 代码库）先建立 codebase map
- 在 `/gsd-new-project` 之后（greenfield 代码库）随着代码演进更新 codebase map
- 随时刷新对代码库的理解
</context>

<when_to_use>
**以下情况适合使用 map-codebase：**
- 初始化前的 brownfield 项目（先理解现有代码）
- 重大变更后刷新 codebase map
- 接手一个陌生代码库时
- 大型重构前（先理解当前状态）
- 当 STATE.md 引用了过时的 codebase 信息时

**以下情况跳过 map-codebase：**
- 尚无代码的 greenfield 项目（没有可映射内容）
- 过于简单的代码库（少于 5 个文件）
</when_to_use>

<process>
1. 解析参数并确定映射范围（full、area 或 repos）
2. 检查 `.planning/codebase/` 是否已存在（除 `--repos` scoped update 外，提供刷新或跳过选项）
3. 创建 `.planning/codebase/` 目录结构
4. 启动 4 个并行的 gsd-codebase-mapper agents：
   - Agent 1：tech focus → 写入 STACK.md、INTEGRATIONS.md
   - Agent 2：arch focus → 写入 ARCHITECTURE.md、STRUCTURE.md
   - Agent 3：quality focus → 写入 CONVENTIONS.md、TESTING.md
   - Agent 4：concerns focus → 写入 CONCERNS.md
5. 等待 agents 完成并收集确认信息（不是文档内容本身）
6. 校验 7 份文档都存在，并统计行数
7. 提交 codebase map
8. 提供后续步骤（通常是：`/gsd-new-project` 或 `/gsd-plan-phase`）
</process>

<success_criteria>
- [ ] 已创建 `.planning/codebase/` 目录
- [ ] 所有 7 份 codebase 文档都已由 mapper agents 写入
- [ ] 文档符合模板结构
- [ ] 并行 agents 已无错误完成
- [ ] 用户清楚后续步骤
</success_criteria>
