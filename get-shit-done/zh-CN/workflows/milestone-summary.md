# Milestone 总结工作流

根据已完成的 milestone 产物生成一份完整、易读、适合人阅读的项目总结。
面向团队 onboarding 设计，新加入的贡献者阅读输出后应能理解整个项目。

---

## Step 1: 解析 Version

```bash
VERSION="$ARGUMENTS"
```

如果 `$ARGUMENTS` 为空：
1. 检查 `.planning/STATE.md` 获取当前 milestone version
2. 检查 `.planning/milestones/` 获取最近归档的 version
3. 如果两者都没有，检查 `.planning/ROADMAP.md` 是否存在（项目可能仍在该 milestone 中）
4. 如果仍然找不到：报错 `"No milestone found. Run /gsd-new-project or /gsd-new-milestone first."`

将 `VERSION` 设为解析出的版本（例如 `"1.0"`）。

## Step 2: 定位产物

判断该 milestone 是 **archived** 还是 **current**：

**Archived milestone**（存在 `.planning/milestones/v{VERSION}-ROADMAP.md`）：
```
ROADMAP_PATH=".planning/milestones/v${VERSION}-ROADMAP.md"
REQUIREMENTS_PATH=".planning/milestones/v${VERSION}-REQUIREMENTS.md"
AUDIT_PATH=".planning/milestones/v${VERSION}-MILESTONE-AUDIT.md"
```

**Current/in-progress milestone**（尚未归档）：
```
ROADMAP_PATH=".planning/ROADMAP.md"
REQUIREMENTS_PATH=".planning/REQUIREMENTS.md"
AUDIT_PATH=".planning/v${VERSION}-MILESTONE-AUDIT.md"
```

注意：audit 文件在归档时会移动到 `.planning/milestones/`（见 `complete-milestone` workflow）。作为兜底，请同时检查这两个位置。

**始终可用：**
```
PROJECT_PATH=".planning/PROJECT.md"
RETRO_PATH=".planning/RETROSPECTIVE.md"
STATE_PATH=".planning/STATE.md"
```

读取所有存在的文件。缺失文件没有关系，总结会根据可用内容自适应。

## Step 3: 发现 Phase 产物

找到所有 phase 目录：

```bash
gsd-sdk query init.progress
```

这会返回 phase metadata。对 milestone 范围内的每个 phase：

- 如果存在，读取 `{phase_dir}/{padded}-SUMMARY.md`，提取 `one_liner`、`accomplishments`、`decisions`
- 如果存在，读取 `{phase_dir}/{padded}-VERIFICATION.md`，提取状态、缺口、延期项
- 如果存在，读取 `{phase_dir}/{padded}-CONTEXT.md`，从 `<decisions>` section 提取关键决策
- 如果存在，读取 `{phase_dir}/{padded}-RESEARCH.md`，记录研究了什么

记录每个 phase 具备哪些产物。

**如果不存在 phase 目录**（空 milestone 或构建前状态）：跳到 Step 5，生成最简总结并注明 `"No phases have been executed yet."`。不要报错，总结仍应覆盖 `PROJECT.md` 和 `ROADMAP.md` 的内容。

## Step 4: 收集 Git 统计

按顺序尝试以下方法，直到有一个成功：

**Method 1 — Tagged milestone**（先检查）：
```bash
git tag -l "v${VERSION}" | head -1
```
如果 tag 存在：
```bash
git log v${VERSION} --oneline | wc -l
git diff --stat $(git log --format=%H --reverse v${VERSION} | head -1)..v${VERSION}
```

**Method 2 — STATE.md 日期范围**（如果没有 tag）：
读取 STATE.md，提取 `started_at` 或最早的 session 日期，并将其作为 `--since` 边界：
```bash
git log --oneline --since="<started_at_date>" | wc -l
```

**Method 3 — Earliest phase commit**（如果 STATE.md 没有日期）：
找到最早的 `.planning/phases/` commit：
```bash
git log --oneline --diff-filter=A -- ".planning/phases/" | tail -1
```
使用该 commit 的日期作为开始边界。

**Method 4 — Skip stats**（如果以上都不可用）：
报告 `"Git statistics unavailable — no tag or date range could be determined."`。这不是错误，总结应继续生成，只是不包含 Stats section。

提取以下内容（可用时）：
- milestone 内 commit 总数
- 变更文件数、insertions、deletions
- Timeline（开始日期 → 结束日期）
- Contributors（来自 git log authors）

## Step 5: 生成总结文档

写入 `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md`：

```markdown
# Milestone v{VERSION} — Project Summary

**Generated:** {date}
**Purpose:** Team onboarding and project review

---

## 1. Project Overview

{From PROJECT.md: "What This Is", core value proposition, target users}
{If mid-milestone: note which phases are complete vs in-progress}

## 2. Architecture & Technical Decisions

{From CONTEXT.md files across phases: key technical choices}
{From SUMMARY.md decisions: patterns, libraries, frameworks chosen}
{From PROJECT.md: tech stack if documented}

Present as a bulleted list of decisions with brief rationale:
- **Decision:** {what was chosen}
  - **Why:** {rationale from CONTEXT.md}
  - **Phase:** {which phase made this decision}

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
{For each phase: number, name, status (complete/in-progress/planned), one_liner from SUMMARY.md}

## 4. Requirements Coverage

{From REQUIREMENTS.md: list each requirement with status}
- ✅ {Requirement met}
- ⚠️ {Requirement partially met — note gap}
- ❌ {Requirement not met — note reason}

{If MILESTONE-AUDIT.md exists: include audit verdict}

## 5. Key Decisions Log

{Aggregate from all CONTEXT.md <decisions> sections}
{Each decision with: ID, description, phase, rationale}

## 6. Tech Debt & Deferred Items

{From VERIFICATION.md files: gaps found, anti-patterns noted}
{From RETROSPECTIVE.md: lessons learned, what to improve}
{From CONTEXT.md <deferred> sections: ideas parked for later}

## 7. Getting Started

{Entry points for new contributors:}
- **Run the project:** {from PROJECT.md or SUMMARY.md}
- **Key directories:** {from codebase structure}
- **Tests:** {test command from PROJECT.md or CLAUDE.md}
- **Where to look first:** {main entry points, core modules}

---

## Stats

- **Timeline:** {start} → {end} ({duration})
- **Phases:** {count complete} / {count total}
- **Commits:** {count}
- **Files changed:** {count} (+{insertions} / -{deletions})
- **Contributors:** {list}
```

## Step 6: 写入并 Commit

**Overwrite guard：** 如果 `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md` 已存在，询问用户：
> `"A milestone summary for v{VERSION} already exists. Overwrite it, or view the existing one?"`
如果选择 `"view"`：显示现有文件并跳到 Step 8（interactive mode）。如果选择 `"overwrite"`：继续。

如有需要，创建 reports 目录：
```bash
mkdir -p .planning/reports
```

写入总结，然后 commit：
```bash
gsd-sdk query commit "docs(v${VERSION}): generate milestone summary for onboarding" \
  ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```

## Step 7: 展示总结

内联显示完整的总结文档。

## Step 8: 提供 Interactive Mode

展示总结后：

> `"Summary written to .planning/reports/MILESTONE_SUMMARY-v{VERSION}.md.`
>
> `I have full context from the build artifacts. Want to ask anything about the project?`
> `Architecture decisions, specific phases, requirements, tech debt — ask away."`

如果用户提问：
- 基于已加载的产物回答（`CONTEXT.md`、`SUMMARY.md`、`VERIFICATION.md` 等）
- 引用具体文件和决策
- 以实际构建内容为依据，不做猜测

如果用户结束：
- 建议下一步：`/gsd-new-milestone`、`/gsd-progress`，或将总结分享给团队

## Step 9: 更新 STATE.md

```bash
gsd-sdk query state.record-session "" \
  "Milestone v${VERSION} summary generated" \
  ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```
