# Agent Contracts

所有 GSD agent 的完成标记与交接 schema。工作流使用这些标记来检测 agent 是否完成并据此路由。

本文档描述的是实际情况，而不是应然情况。大小写不一致会按 agent 源文件中的原样记录。

---

## Agent Registry

| Agent | Role | Completion Markers |
|-------|------|--------------------|
| gsd-planner | 计划创建 | `## PLANNING COMPLETE` |
| gsd-executor | 计划执行 | `## PLAN COMPLETE`, `## CHECKPOINT REACHED` |
| gsd-phase-researcher | 按阶段范围研究 | `## RESEARCH COMPLETE`, `## RESEARCH BLOCKED` |
| gsd-project-researcher | 全项目范围研究 | `## RESEARCH COMPLETE`, `## RESEARCH BLOCKED` |
| gsd-plan-checker | 计划校验 | `## VERIFICATION PASSED`, `## ISSUES FOUND` |
| gsd-research-synthesizer | 多份研究综合 | `## SYNTHESIS COMPLETE`, `## SYNTHESIS BLOCKED` |
| gsd-debugger | 调试调查 | `## DEBUG COMPLETE`, `## ROOT CAUSE FOUND`, `## CHECKPOINT REACHED` |
| gsd-roadmapper | 路线图创建/修订 | `## ROADMAP CREATED`, `## ROADMAP REVISED`, `## ROADMAP BLOCKED` |
| gsd-ui-auditor | UI 审查 | `## UI REVIEW COMPLETE` |
| gsd-ui-checker | UI 校验 | `## ISSUES FOUND` |
| gsd-ui-researcher | UI spec 创建 | `## UI-SPEC COMPLETE`, `## UI-SPEC BLOCKED` |
| gsd-verifier | 执行后验证 | `## Verification Complete`（标题式大小写） |
| gsd-integration-checker | 跨阶段集成检查 | `## Integration Check Complete`（标题式大小写） |
| gsd-nyquist-auditor | 抽样审计 | `## PARTIAL`, `## ESCALATE`（非标准） |
| gsd-security-auditor | 安全审计 | `## OPEN_THREATS`, `## ESCALATE`（非标准） |
| gsd-codebase-mapper | 代码库分析 | 无标记（直接写文档） |
| gsd-assumptions-analyzer | 假设提取 | 无标记（返回 `## Assumptions` 段落） |
| gsd-doc-verifier | 文档校验 | 无标记（向 `.planning/tmp/` 写入 JSON） |
| gsd-doc-writer | 文档生成 | 无标记（直接写文档） |
| gsd-advisor-researcher | 咨询式研究 | 无标记（工具型 agent） |
| gsd-user-profiler | 用户画像 | 无标记（在 analysis tags 中返回 JSON） |
| gsd-intel-updater | 代码库情报分析 | `## INTEL UPDATE COMPLETE`, `## INTEL UPDATE FAILED` |

## Marker Rules

1. **全大写 markers**（例如 `## PLANNING COMPLETE`）是标准约定
2. **标题式大小写 markers**（例如 `## Verification Complete`）存在于 gsd-verifier 和 gsd-integration-checker 中，这些是有意如此，不是 bug
3. 审计 agent 中的 **非标准 markers**（例如 `## PARTIAL`, `## ESCALATE`）表示部分结果，需要编排器自行判断
4. **没有 markers 的 agents** 要么直接将工件写入磁盘，要么返回由调用方解析的结构化数据（JSON/sections）
5. markers 必须以 H2 标题形式出现（`## `），位于 agent 最终输出某一行的开头

## Key Handoff Contracts

### Planner -> Executor (via PLAN.md)

| Field | Required | Description |
|-------|----------|-------------|
| Frontmatter | Yes | phase, plan, type, wave, depends_on, files_modified, autonomous, requirements |
| `<objective>` | Yes | 该计划实现什么 |
| `<tasks>` | Yes | 按顺序排列的任务列表，包含 type, files, action, verify, acceptance_criteria |
| `<verification>` | Yes | 整体验证步骤 |
| `<success_criteria>` | Yes | 可衡量的完成标准 |

### Executor -> Verifier (via SUMMARY.md)

| Field | Required | Description |
|-------|----------|-------------|
| Frontmatter | Yes | phase, plan, subsystem, tags, key-files, metrics |
| Commits table | Yes | 每个任务的 commit hash 与说明 |
| Deviations section | Yes | 自动修复的问题，或 `None` |
| Self-Check | Yes | 带细节的 PASSED 或 FAILED |

## Workflow Regex Patterns

工作流会匹配这些 markers 来检测 agent 是否完成：

**plan-phase.md matches:**
- `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED`（researcher 输出）
- `## PLANNING COMPLETE`（planner 输出）
- `## CHECKPOINT REACHED`（planner/executor 暂停）
- `## VERIFICATION PASSED` / `## ISSUES FOUND`（plan-checker 输出）

**execute-phase.md matches:**
- `## PHASE COMPLETE`（该阶段所有计划完成）
- `## Self-Check: FAILED`（summary 自检）

> **NOTE:** `## PLAN COMPLETE` 是 gsd-executor 的完成 marker，但 execute-phase.md 不会用 regex 匹配它。相反，它通过抽查来检测 executor 是否完成（SUMMARY.md 是否存在、git commit 状态）。这是有意行为，不是不匹配。
