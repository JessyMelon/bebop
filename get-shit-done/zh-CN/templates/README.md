# GSD 规范产物注册表

此目录包含 GSD 工作流正式产出的所有产物模板文件。下表是权威索引：**如果某个 `.planning/` 根目录文件未在此列出，`gsd-health` 会将其标记为 W019**（未识别产物）。

在把某个 `.planning/` 文件视为权威之前，代理应先查询此文件。如果文件名未出现在下方，它就不是规范的 GSD 产物。

---

## `.planning/` 根产物

这些文件直接位于 `.planning/` 下，而不在阶段子目录内。

| 文件 | 模板 | 产出来源 | 用途 |
|------|----------|-------------|---------|
| `PROJECT.md` | `project.md` | `/gsd-new-project` | 项目标识、目标、需求摘要 |
| `ROADMAP.md` | `roadmap.md` | `/gsd-new-milestone`, `/gsd-new-project` | 带里程碑和进度跟踪的阶段计划 |
| `STATE.md` | `state.md` | `/gsd-new-project`, `/gsd-health --repair` | 当前会话状态、活跃阶段、最近活动 |
| `REQUIREMENTS.md` | `requirements.md` | `/gsd-new-milestone` | 带可追踪性的功能需求 |
| `MILESTONES.md` | `milestone.md` | `/gsd-complete-milestone` | 已完成里程碑及其成果记录 |
| `BACKLOG.md` | *(inline)* | `/gsd-add-backlog` | 待处理想法和延期工作 |
| `LEARNINGS.md` | *(inline)* | `/gsd-extract-learnings`, `/gsd-execute-phase` | 供后续计划使用的阶段复盘经验 |
| `THREADS.md` | *(inline)* | `/gsd-thread` | 持久化讨论线程 |
| `config.json` | `config.json` | `/gsd-new-project`, `/gsd-health --repair` | 项目专属 GSD 配置 |
| `CLAUDE.md` | `claude-md.md` | `/gsd-profile` | 自动组装的 Claude Code 上下文文件 |

### 带版本戳的产物（模式：`vX.Y-*.md`）

| 模式 | 产出来源 | 用途 |
|---------|-------------|---------|
| `vX.Y-MILESTONE-AUDIT.md` | `/gsd-audit-milestone` | 归档前的里程碑审计报告 |

这些文件会由 `/gsd-complete-milestone` 归档到 `.planning/milestones/`。如果在完成后仍在 `.planning/` 根目录看到它们，说明跳过了归档步骤。

---

## 阶段子目录产物（`.planning/phases/NN-name/`）

这些文件位于阶段目录内部。W019 不会检查它们（W019 只检查 `.planning/` 根目录）。

| 文件模式 | 模板 | 产出来源 | 用途 |
|-------------|----------|-------------|---------|
| `NN-MM-PLAN.md` | `phase-prompt.md` | `/gsd-plan-phase` | 可执行实现计划 |
| `NN-MM-SUMMARY.md` | `summary.md` | `/gsd-execute-phase` | 执行后的总结及经验 |
| `NN-CONTEXT.md` | `context.md` | `/gsd-discuss-phase` | 该阶段范围内的讨论决策 |
| `NN-RESEARCH.md` | `research.md` | `/gsd-research-phase`, `/gsd-plan-phase` | 该阶段的技术研究 |
| `NN-VALIDATION.md` | `VALIDATION.md` | `/gsd-research-phase` (Nyquist) | 验证架构（Nyquist 方法） |
| `NN-UAT.md` | `UAT.md` | `/gsd-validate-phase` | 用户验收测试结果 |
| `NN-PATTERNS.md` | *(inline)* | `/gsd-plan-phase` (pattern mapper) | 该阶段的类比文件映射 |
| `NN-UI-SPEC.md` | `UI-SPEC.md` | `/gsd-ui-phase` | UI 设计契约 |
| `NN-SECURITY.md` | `SECURITY.md` | `/gsd-secure-phase` | 安全威胁模型 |
| `NN-AI-SPEC.md` | `AI-SPEC.md` | `/gsd-ai-integration-phase` | 带 eval 策略的 AI 集成规范 |
| `NN-DEBUG.md` | `DEBUG.md` | `/gsd-debug` | 调试会话日志 |
| `NN-REVIEWS.md` | *(inline)* | `/gsd-review` | 跨 AI 评审反馈 |

---

## 里程碑归档（`.planning/milestones/`）

由 `/gsd-complete-milestone` 归档的文件。W019 永远不会检查这些文件。

| File Pattern | Source |
|-------------|--------|
| `vX.Y-ROADMAP.md` | 里程碑关闭时的 ROADMAP.md 快照 |
| `vX.Y-REQUIREMENTS.md` | 里程碑关闭时的 REQUIREMENTS.md 快照 |
| `vX.Y-MILESTONE-AUDIT.md` | 从 `.planning/` 根目录移动而来 |
| `vX.Y-phases/` | 已归档的阶段目录（使用 `--archive-phases` 时） |

---

## 添加新的规范产物

当新的工作流会产出 `.planning/` 根目录文件时：

1. 将文件名加入 `get-shit-done/bin/lib/artifacts.cjs` 中的 `CANONICAL_EXACT`
2. 在上方 **`.planning/` 根产物** 表格中添加一行
3. 如果有模板，则将模板加入 `get-shit-done/templates/`
