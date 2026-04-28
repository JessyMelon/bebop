<purpose>
通过聚合各 phase 的验证结果、检查跨 phase 集成情况，并评估 requirements 覆盖率，验证 milestone 是否达到 definition of done。读取已有 VERIFICATION.md files（这些 phase 已在 execute-phase 期间验证过），汇总 tech debt 和延期 gaps，然后启动 integration checker 检查跨 phase wiring。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-integration-checker — 检查跨 phase 集成
</available_agent_types>

<process>

## 0. 初始化 Milestone 上下文

```bash
INIT=$(gsd-sdk query init.milestone-op)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_CHECKER=$(gsd-sdk query agent-skills gsd-integration-checker 2>/dev/null)
```

从 init JSON 提取：`milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `commit_docs`。

解析 integration checker model：
```bash
integration_checker_model=$(gsd-sdk query resolve-model gsd-integration-checker --raw)
```

## 1. 确定 Milestone 范围

```bash
# Get phases in milestone (sorted numerically, handles decimals)
gsd-sdk query phases.list
```

- 从参数中解析版本，或从 ROADMAP.md 检测当前版本
- 识别范围内的所有 phase 目录
- 从 ROADMAP.md 提取该 milestone 的 definition of done
- 从 REQUIREMENTS.md 提取映射到该 milestone 的 requirements

## 2. 读取所有 Phase 验证结果

对每个 phase 目录，读取对应的 VERIFICATION.md：

```bash
# For each phase, use find-phase to resolve the directory (handles archived phases)
PHASE_INFO=$(gsd-sdk query find-phase 01 --raw)
# Extract directory from JSON, then read VERIFICATION.md from that directory
# Repeat for each phase number from ROADMAP.md
```

从每个 VERIFICATION.md 提取：
- **Status:** passed | gaps_found
- **Critical gaps:**（如有，这些是 blockers）
- **Non-critical gaps:** tech debt、deferred items、warnings
- **Anti-patterns found:** TODOs、stubs、placeholders
- **Requirements coverage:** 哪些 requirements 已满足/被阻塞

如果某个 phase 缺少 VERIFICATION.md，标记为 "unverified phase"，这属于 blocker。

## 3. 启动 Integration Checker

在收集好 phase 上下文后：

从 REQUIREMENTS.md 的 traceability table 提取 `MILESTONE_REQ_IDS`，即分配到该 milestone phases 的所有 REQ-IDs。

```
Task(
  prompt="Check cross-phase integration and E2E flows.

Phases: {phase_dirs}
Phase exports: {from SUMMARYs}
API routes: {routes created}

Milestone Requirements:
{MILESTONE_REQ_IDS — list each REQ-ID with description and assigned phase}

MUST map each integration finding to affected requirement IDs where applicable.

Verify cross-phase wiring and E2E user flows.
${AGENT_SKILLS_CHECKER}",
  subagent_type="gsd-integration-checker",
  model="{integration_checker_model}"
)
```

## 4. 收集结果

合并：
- 第 2 步中的 phase 级 gaps 和 tech debt
- integration checker 的报告（wiring gaps、broken flows）

## 5. 检查 Requirements 覆盖率（3 源交叉核对）

必须对每个 requirement 交叉核对三个独立来源：

### 5a. 解析 REQUIREMENTS.md Traceability Table

从 traceability table 中提取映射到该 milestone phases 的所有 REQ-IDs：
- Requirement ID、description、assigned phase、current status、checked-off state（`[x]` vs `[ ]`）

### 5b. 解析各 Phase VERIFICATION.md 的 Requirements Tables

从每个 phase 的 VERIFICATION.md 提取扩展后的 requirements table：
- Requirement | Source Plan | Description | Status | Evidence
- 将每条记录映射回其 REQ-ID

### 5c. 提取 SUMMARY.md Frontmatter 进行交叉核对

从每个 phase 的 SUMMARY.md 提取 YAML frontmatter 中的 `requirements-completed`：
```bash
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  [ -e "$summary" ] || continue
  gsd-sdk query summary-extract "$summary" --fields requirements_completed --pick requirements_completed
done
```

### 5d. 状态判定矩阵

对每个 REQ-ID，综合三方来源判定状态：

| VERIFICATION.md Status | SUMMARY Frontmatter | REQUIREMENTS.md | → Final Status |
|------------------------|---------------------|-----------------|----------------|
| passed                 | listed              | `[x]`           | **satisfied**  |
| passed                 | listed              | `[ ]`           | **satisfied** (update checkbox) |
| passed                 | missing             | any             | **partial** (verify manually) |
| gaps_found             | any                 | any             | **unsatisfied** |
| missing                | listed              | any             | **partial** (verification gap) |
| missing                | missing             | any             | **unsatisfied** |

### 5e. FAIL Gate 与 Orphan Detection

**强制要求：** 任何 `unsatisfied` requirement 都必须让 milestone audit 的状态变成 `gaps_found`。

**Orphan detection：** 在 REQUIREMENTS.md traceability table 中存在、但在所有 phase VERIFICATION.md files 中都不存在的 requirements，必须标记为 orphaned。Orphaned requirements 视为 `unsatisfied`，因为它们虽然被分配了，但从未被任何 phase 验证。

## 5.5. Nyquist 合规性探测

如果 `workflow.nyquist_validation` 明确为 `false`，则跳过（缺失视为启用）。

```bash
NYQUIST_CONFIG=$(gsd-sdk query config-get workflow.nyquist_validation --raw 2>/dev/null)
```

如果为 `false`：完全跳过。

对每个 phase 目录，检查 `*-VALIDATION.md`。如果存在，解析 frontmatter（`nyquist_compliant`, `wave_0_complete`）。

按 phase 归类：

| Status | Condition |
|--------|-----------|
| COMPLIANT | `nyquist_compliant: true` and all tasks green |
| PARTIAL | VALIDATION.md exists, `nyquist_compliant: false` or red/pending |
| MISSING | No VALIDATION.md |

写入 audit YAML：`nyquist: { compliant_phases, partial_phases, missing_phases, overall }`

只做探测，绝不自动调用 `/gsd-validate-phase`。

## 6. 汇总到 v{version}-MILESTONE-AUDIT.md

创建 `.planning/v{version}-v{version}-MILESTONE-AUDIT.md`，内容如下：

```yaml
---
milestone: {version}
audited: {timestamp}
status: passed | gaps_found | tech_debt
scores:
  requirements: N/M
  phases: N/M
  integration: N/M
  flows: N/M
gaps:  # Critical blockers
  requirements:
    - id: "{REQ-ID}"
      status: "unsatisfied | partial | orphaned"
      phase: "{assigned phase}"
      claimed_by_plans: ["{plan files that reference this requirement}"]
      completed_by_plans: ["{plan files whose SUMMARY marks it complete}"]
      verification_status: "passed | gaps_found | missing | orphaned"
      evidence: "{specific evidence or lack thereof}"
  integration: [...]
  flows: [...]
tech_debt:  # Non-critical, deferred
  - phase: 01-auth
    items:
      - "TODO: add rate limiting"
      - "Warning: no password strength validation"
  - phase: 03-dashboard
    items:
      - "Deferred: mobile responsive layout"
---
```

并补充完整 markdown 报告，包含 requirements、phases、integration、tech debt 各表格。

**状态值：**
- `passed` — 所有 requirements 满足，无 critical gaps，tech debt 很少
- `gaps_found` — 存在 critical blockers
- `tech_debt` — 没有 blockers，但累计的延期项需要审查

## 7. 展示结果

按状态路由（见 `<offer_next>`）。

</process>

<offer_next>
直接输出以下 markdown（不要放进 code block）。按状态路由：

---

**如果 passed：**

## ✓ Milestone {version} — Audit Passed

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

所有 requirements 都已覆盖。跨 phase 集成已验证。E2E flows 完整。

───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**完成 milestone** — 归档并打 tag

`/clear` 然后：

`/gsd-complete-milestone {version}`

───────────────────────────────────────────────────────────────

---

**如果 gaps_found：**

## ⚠ Milestone {version} — Gaps Found

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Phase {X})
  - {reason}

### Cross-Phase Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

### Broken Flows

{For each flow gap:}
- **{flow name}:** breaks at {step}

### Nyquist Coverage

| Phase | VALIDATION.md | Compliant | Action |
|-------|---------------|-----------|--------|
| {phase} | exists/missing | true/false/partial | `/gsd-validate-phase {N}` |

需要验证的 phases：对每个标记的 phase 运行 `/gsd-validate-phase {N}`。

───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**规划 gap closure** — 创建 phases 补齐 milestone

`/clear` 然后：

`/gsd-plan-milestone-gaps`

───────────────────────────────────────────────────────────────

**也可继续：**
- `cat .planning/v{version}-MILESTONE-AUDIT.md` — 查看完整报告
- `/gsd-complete-milestone {version}` — 仍然继续（接受 tech debt）

───────────────────────────────────────────────────────────────

---

**如果 tech_debt（无 blockers，但有累计 debt）：**

## ⚡ Milestone {version} — Tech Debt Review

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

所有 requirements 已满足。没有 critical blockers。累计 tech debt 需要审查。

### Tech Debt by Phase

{For each phase with debt:}
**Phase {X}: {name}**
- {item 1}
- {item 2}

### Total: {N} items across {M} phases

───────────────────────────────────────────────────────────────

## ▶ Options

**A. 完成 milestone** — 接受 debt，并在 backlog 中跟踪

`/gsd-complete-milestone {version}`

**B. 规划 cleanup phase** — 完成前先处理 debt

`/clear` 然后：

`/gsd-plan-milestone-gaps`

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] 已识别 milestone 范围
- [ ] 已读取所有 phase VERIFICATION.md files
- [ ] 已提取每个 phase 的 SUMMARY.md `requirements-completed` frontmatter
- [ ] 已解析 REQUIREMENTS.md traceability table 中该 milestone 的全部 REQ-IDs
- [ ] 已完成 3 源交叉核对（VERIFICATION + SUMMARY + traceability）
- [ ] 已检测 orphaned requirements（在 traceability 中，但缺失于所有 VERIFICATION）
- [ ] 已汇总 tech debt 和延期 gaps
- [ ] 已使用 milestone requirement IDs 启动 integration checker
- [ ] 已创建 v{version}-MILESTONE-AUDIT.md，并带结构化 requirement gap 对象
- [ ] 已强制执行 FAIL gate：任一 unsatisfied requirement 都会导致 gaps_found
- [ ] 已扫描该 milestone 全部 phases 的 Nyquist 合规性（若启用）
- [ ] 缺失 VALIDATION.md 的 phases 已标出并建议运行 validate-phase
- [ ] 已展示带可执行后续步骤的结果
</success_criteria>
