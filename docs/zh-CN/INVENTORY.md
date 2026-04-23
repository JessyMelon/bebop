# GSD 已发布表面清单

> GSD 所有已发布表面的权威清单：命令、代理、工作流、参考资料、CLI 模块和 hooks。若广义文档（AGENTS.md、COMMANDS.md、ARCHITECTURE.md、CLI-TOOLS.md）与文件系统不一致，以本文件和仓库目录树为准。

## 使用说明

- 这里的数量来自 v1.36.0 固定点，后续版本可能变化。
- 本文件列出六大类所有已发布表面。
- 新增表面应先写入此处，再同步到广义文档。

---

## 代理（33 个已发布）

完整列表在 `agents/gsd-*.md`。`Primary doc` 列表示 `docs/AGENTS.md` 是否提供完整角色卡。

| 代理 | 职责（一句话） | 由谁启动 | 主文档 |
|-------|----------------|----------|--------|
| gsd-project-researcher | 在创建路线图前研究领域生态（stack、features、architecture、pitfalls）。 | `/gsd-new-project`、`/gsd-new-milestone` | primary |
| gsd-phase-researcher | 在规划前研究某个阶段的实现方案。 | `/gsd-plan-phase` | primary |
| gsd-ui-researcher | 为前端阶段生成 UI 设计契约。 | `/gsd-ui-phase` | primary |
| gsd-assumptions-analyzer | 为 discuss-phase（assumptions 模式）产出有证据支持的假设。 | `discuss-phase-assumptions` 工作流 | primary |
| gsd-advisor-researcher | 为 discuss-phase advisor 模式研究单个灰色决策。 | `discuss-phase` 工作流 | primary |

> 其余代理、命令和工作流清单后续可继续翻完整表。

---

## 命令（83 个已发布）

完整列表在 `commands/gsd/*.md`。下表与 `docs/COMMANDS.md` 的章节结构一致。

### 核心工作流

| 命令 | 职责 | 来源 |
|---------|------|--------|
| `/gsd-new-project` | 通过深度上下文收集初始化新项目。 | `commands/gsd/new-project.md` |
| `/gsd-new-workspace` | 创建隔离工作空间。 | `commands/gsd/new-workspace.md` |
| `/gsd-discuss-phase` | 在规划前通过自适应提问收集阶段上下文。 | `commands/gsd/discuss-phase.md` |
| `/gsd-plan-phase` | 生成带验证循环的详细阶段计划。 | `commands/gsd/plan-phase.md` |
| `/gsd-execute-phase` | 以 wave 方式并行执行阶段计划。 | `commands/gsd/execute-phase.md` |

> 其余命令分组后续继续补全。
