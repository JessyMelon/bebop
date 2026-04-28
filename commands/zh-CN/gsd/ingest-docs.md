---
name: gsd:ingest-docs
description: 扫描仓库中的 ADR、PRD、SPEC 和 DOC 等混合文档，并据此初始化或合并完整的 `.planning/` 配置。并行分类每份文档，综合生成带冲突报告的统一上下文，再根据 `.planning/` 是否已存在路由到 new-project 或 merge-milestone。
argument-hint: "[path] [--mode new|merge] [--manifest <file>] [--resolve auto|interactive]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
基于多份已存在的规划文档（ADRs、PRDs、SPECs、DOCs），一次性构建完整的 `.planning/` 配置，或将其合并进已有配置。

- **全新初始化**（`--mode new`，当 `.planning/` 不存在时默认）：根据综合后的文档内容生成 PROJECT.md + REQUIREMENTS.md + ROADMAP.md + STATE.md，并将最终生成委托给 `gsd-roadmapper`。
- **合并到现有配置**（`--mode merge`，当 `.planning/` 已存在时默认）：追加从导入文档推导出的 phases 和 requirements；如果与现有已锁定决策冲突则强制阻止。

按照优先级规则 `ADR > SPEC > PRD > DOC` 自动综合大多数冲突（可通过 manifest 覆盖）。将未解决情况写入 `.planning/INGEST-CONFLICTS.md`，分为三类：auto-resolved、competing-variants、unresolved-blockers。共享冲突引擎中的 BLOCKER gate 会在仍有未解决矛盾时阻止写入任何目标文件。

**输入：** 按目录约定发现文档（`docs/adr/`、`docs/prd/`、`docs/specs/`、`docs/rfc/`、根目录下的 `{ADR,PRD,SPEC,RFC}-*.md`），或通过显式的 `--manifest <file>` YAML 为每份文档列出 `{path, type, precedence?}`。

**v1 限制：** 每次调用最多 50 份文档；`--resolve interactive` 预留给未来版本。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ingest-docs.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
@~/.claude/get-shit-done/references/doc-conflict-engine.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
端到端执行 ingest-docs workflow。保留所有审批 gate（discovery、conflict report、routing）以及 BLOCKER 安全规则。
</process>
