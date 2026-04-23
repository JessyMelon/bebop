# GSD 命令参考

> 稳定命令的语法、标志、选项和示例。功能细节请参阅 [FEATURES.md](FEATURES.md)。工作流演练请参阅 [USER-GUIDE.md](USER-GUIDE.md)。

---

## 命令语法

- **Claude Code / Gemini / Copilot：** `/gsd-command-name [args]`
- **OpenCode / Kilo：** `/gsd-command-name [args]`
- **Codex：** `$gsd-command-name [args]`

---

## 核心工作流命令

### `/gsd-new-project`

通过深度上下文收集初始化一个新项目。

| 标志 | 说明 |
|------|-------------|
| `--auto @file.md` | 从文档自动提取，跳过交互式问题 |

**前提条件：** 不能已有 `.planning/PROJECT.md`
**产出：** `PROJECT.md`、`REQUIREMENTS.md`、`ROADMAP.md`、`STATE.md`、`config.json`、`research/`、`CLAUDE.md`

```bash
/gsd-new-project                    # 交互模式
/gsd-new-project --auto @prd.md     # 从 PRD 自动提取
```

---

### `/gsd-new-workspace`

创建一个隔离的工作空间，包含仓库副本和独立的 `.planning/` 目录。

| 标志 | 说明 |
|------|-------------|
| `--name <name>` | 工作空间名称（必需） |
| `--repos repo1,repo2` | 逗号分隔的仓库路径或名称 |
| `--path /target` | 目标目录（默认：`~/gsd-workspaces/<name>`） |
| `--strategy worktree\|clone` | 复制策略（默认：`worktree`） |
| `--branch <name>` | 要检出的分支（默认：`workspace/<name>`） |
| `--auto` | 跳过交互式问题 |

**适用场景：**
- 多仓库：在隔离的 GSD 状态下处理部分仓库
- 功能隔离：`--repos .` 会创建当前仓库的 worktree

**产出：** `WORKSPACE.md`、`.planning/`、仓库副本（worktree 或 clone）

```bash
/gsd-new-workspace --name feature-b --repos hr-ui,ZeymoAPI
/gsd-new-workspace --name feature-b --repos . --strategy worktree  # 同仓库隔离
/gsd-new-workspace --name spike --repos api,web --strategy clone   # 完整克隆
```

---

### `/gsd-list-workspaces`

列出当前活跃的 GSD 工作空间及其状态。

**扫描：** `~/gsd-workspaces/` 中的 `WORKSPACE.md` 清单
**显示：** 名称、仓库数量、策略、GSD 项目状态

```bash
/gsd-list-workspaces
```

---

### `/gsd-remove-workspace`

移除工作空间并清理 git worktree。

| 参数 | 必需 | 说明 |
|----------|----------|-------------|
| `<name>` | 是 | 要移除的工作空间名称 |

**安全性：** 如果任一仓库存在未提交更改，则拒绝移除。需要名称确认。

```bash
/gsd-remove-workspace feature-b
```

---

### `/gsd-discuss-phase`

在规划前收集实现决策。

| 参数 | 必需 | 说明 |
|------|------|------|
| `N` | 否 | 阶段编号（默认当前阶段） |

| 标志 | 说明 |
|------|------|
| `--all` | 跳过区域选择，讨论所有灰区 |
| `--auto` | 为所有问题自动选择推荐默认值 |
| `--batch` | 批量收集问题 |
| `--analyze` | 增加权衡分析 |
| `--power` | 从预写答案文件中批量回答 |

**前提条件：** `.planning/ROADMAP.md` 存在
**产出：** `{phase}-CONTEXT.md`、`{phase}-DISCUSSION-LOG.md`

---

### `/gsd-ui-phase`

为前端阶段生成 UI 设计契约。

**前提条件：** `.planning/ROADMAP.md` 存在且该阶段包含前端/UI 工作
**产出：** `{phase}-UI-SPEC.md`

---

### `/gsd-plan-phase`

研究、规划并验证一个阶段。

**前提条件：** `.planning/ROADMAP.md` 存在
**产出：** `{phase}-RESEARCH.md`、`{phase}-{N}-PLAN.md`、`{phase}-VALIDATION.md`

---

### `/gsd-plan-review-convergence`

跨 AI 计划收敛循环，直到不再有 HIGH 级别问题。

**产出：** 经过多轮评审和重规划后的计划结果

---

### `/gsd-ultraplan-phase`

**[BETA，仅 Claude Code]** 将 plan-phase 卸载到 Claude Code 的 ultraplan 云端。

---

### `/gsd-execute-phase`

以 wave 并行方式执行某一阶段的所有计划。

**前提条件：** 阶段已有 PLAN.md
**产出：** 每个计划的 `{phase}-{N}-SUMMARY.md`、git commits、`{phase}-VERIFICATION.md`

---

### `/gsd-verify-work`

逐项做 UAT 并自动诊断失败。

---

### `/gsd-next`

自动推进到下一个逻辑工作流步骤。

---

### `/gsd-session-report`

生成会话报告，记录工作摘要、结果和资源估算。

---

### `/gsd-ship`

把已完成阶段打包成 PR，并自动生成 PR 正文。

---

### `/gsd-ui-review`

对已实现前端做 6 支柱视觉审计。

---

### `/gsd-audit-uat`

审计所有未完成的 UAT 和验证项。

---

### `/gsd-audit-milestone`

验证里程碑是否达到完成定义。

---

### `/gsd-complete-milestone`

归档里程碑并打 tag。

---

### `/gsd-milestone-summary`

从里程碑工件生成综合摘要。

---

### `/gsd-new-milestone`

开始下一个版本周期。

---

### `/gsd-add-phase` / `/gsd-insert-phase` / `/gsd-remove-phase`

在路线图中追加、插入或移除阶段。

---

### `/gsd-list-phase-assumptions`

查看规划前的阶段假设。

---

### `/gsd-analyze-dependencies`

分析阶段依赖并建议 `Depends on` 条目。

---

### `/gsd-plan-milestone-gaps`

为里程碑审计中发现的缺口创建阶段。

---

### `/gsd-research-phase`

只做某个阶段的深度生态研究。

---

### `/gsd-validate-phase`

回溯审计并补齐 Nyquist 验证缺口。

---

### `/gsd-progress`

显示当前状态和下一步。

---

### `/gsd-resume-work`

从上次会话恢复完整上下文。

---

### `/gsd-pause-work`

在阶段中断时保存上下文交接。

---

### `/gsd-manager`

在一个终端里管理多个阶段的交互式控制台。

---

### `/gsd-help`

显示全部命令和使用说明。

---

### `/gsd-explore`

用苏格拉底式提问探索想法。

---

### `/gsd-undo`

安全回滚 GSD 阶段或计划提交。

---

### `/gsd-import`

导入外部计划并进行冲突检测。

---

### `/gsd-ingest-docs`

扫描 ADR/PRD/SPEC/DOC 并一键生成 `.planning/`。

---

### `/gsd-from-gsd2`

把 GSD-2 格式迁移回 v1 `.planning/`。

---

### `/gsd-quick`

以较快路径执行带 GSD 保证的临时任务。

---

### `/gsd-autonomous`

自主执行剩余阶段。

---

### `/gsd-do`

把自由文本自动路由到合适的 GSD 命令。

---

### `/gsd-note`

零打扰记录想法、列表或转 todo。

---

### `/gsd-debug`

系统化调试，支持持久状态。

---

### `/gsd-add-todo` / `/gsd-check-todos`

记录 todo 并从待办中选择下一项。

---

### `/gsd-add-tests`

为完成的阶段生成测试。

---

### `/gsd-stats`

显示项目统计面板。

---

### `/gsd-profile-user`

从会话分析中生成开发者行为画像。

---

### `/gsd-health`

检查 `.planning/` 完整性。

---

### `/gsd-cleanup`

归档已完成里程碑的阶段目录。

---

### `/gsd-spike` / `/gsd-spike-wrap-up`

先做可行性 spike，再把结果打包成可复用技能。

---

### `/gsd-sketch` / `/gsd-sketch-wrap-up`

先用 HTML 草图探索设计方向，再打包胜出方案。

---

### `/gsd-forensics`

对失败或卡住的 GSD 工作流做事后调查。

---

### `/gsd-extract-learnings`

从已完成阶段中提取可复用经验。

---

### `/gsd-workstreams`

管理并行工作流。

---

### `/gsd-settings` / `/gsd-set-profile`

管理配置与模型 profile。

---

### `/gsd-map-codebase` / `/gsd-scan`

分析现有代码库，或进行轻量扫描。

---

### `/gsd-intel` / `/gsd-graphify`

查询或刷新可检索的代码库情报与知识图谱。

---

### `/gsd-ai-integration-phase` / `/gsd-eval-review`

AI 集成阶段向导与事后评审。

---

### `/gsd-update` / `/gsd-reapply-patches`

更新 GSD 并恢复本地修改。

---

### `/gsd-code-review` / `/gsd-code-review-fix` / `/gsd-audit-fix`

代码审查、自动修复和审计到修复流水线。

---

### `/gsd-fast`

直接内联执行极小任务。

---

### `/gsd-review`

调用外部 AI CLI 做交叉评审。

---

### `/gsd-pr-branch`

生成去掉 `.planning/` 提交的干净 PR 分支。

---

### `/gsd-secure-phase`

回溯验证威胁缓解是否落地。

---

### `/gsd-docs-update`

生成或更新文档，并验证事实准确性。

---

### `/gsd-add-backlog` / `/gsd-review-backlog` / `/gsd-plant-seed`

管理 backlog 和长期想法。

---

### `/gsd-thread`

管理跨会话的持久上下文线程。

---

### `state validate` / `state sync` / `state planned-phase`

校验和同步 STATE.md。

---

### 社区 hooks / `/gsd-join-discord`

可选社区 hooks，以及加入 Discord 的入口。

---

### `/gsd-discuss-phase`

在规划前收集实现决策。

| 参数 | 必需 | 说明 |
|----------|----------|-------------|
| `N` | 否 | 阶段编号（默认当前阶段） |

| 标志 | 说明 |
|------|-------------|
| `--all` | 跳过区域选择，交互式讨论所有灰色区域（不自动推进） |
| `--auto` | 为所有问题自动选择推荐默认值 |
| `--batch` | 将问题分批收集，而不是逐个提问 |
| `--analyze` | 在讨论中加入权衡分析 |
| `--power` | 从预先准备的答案文件中批量回答 |

**前提条件：** `.planning/ROADMAP.md` 已存在
**产出：** `{phase}-CONTEXT.md`、`{phase}-DISCUSSION-LOG.md`（审计轨迹）

```bash
/gsd-discuss-phase 1                # 阶段 1 的交互式讨论
/gsd-discuss-phase 1 --all          # 不经过选择步骤，讨论所有灰区
/gsd-discuss-phase 3 --auto         # 阶段 3 自动选默认值
/gsd-discuss-phase --batch          # 当前阶段的批量模式
/gsd-discuss-phase 2 --analyze      # 带权衡分析的讨论
/gsd-discuss-phase 1 --power        # 从文件批量答题
```

---

### `/gsd-ui-phase`

为前端阶段生成 UI 设计契约。

| 参数 | 必需 | 说明 |
|----------|----------|-------------|
| `N` | 否 | 阶段编号（默认当前阶段） |

**前提条件：** `.planning/ROADMAP.md` 已存在，且该阶段包含前端/UI 工作
**产出：** `{phase}-UI-SPEC.md`

```bash
/gsd-ui-phase 2                     # 阶段 2 的设计契约
```

---

### `/gsd-plan-phase`

研究、规划并验证一个阶段。

| 参数 | 必需 | 说明 |
|----------|----------|-------------|
| `N` | 否 | 阶段编号（默认下一个未规划阶段） |

| 标志 | 说明 |
|------|-------------|
| `--auto` | 跳过交互确认 |
| `--research` | 即使 `RESEARCH.md` 已存在，也强制重新研究 |
| `--skip-research` | 跳过领域研究步骤 |
| `--gaps` | 缺口闭合模式（读取 `VERIFICATION.md`，跳过研究） |
| `--skip-verify` | 跳过 plan checker 验证循环 |
| `--prd <file>` | 用 PRD 文件代替 discuss-phase 上下文 |
| `--reviews` | 使用 `REVIEWS.md` 中的跨 AI 评审反馈重新规划 |
| `--validate` | 在规划开始前运行状态校验 |
| `--bounce` | 规划后运行外部 bounce 验证（使用 `workflow.plan_bounce_script`） |
| `--skip-bounce` | 即使配置启用，也跳过 bounce 验证 |

**前提条件：** `.planning/ROADMAP.md` 已存在
**产出：** `{phase}-RESEARCH.md`、`{phase}-{N}-PLAN.md`、`{phase}-VALIDATION.md`

```bash
/gsd-plan-phase 1                   # 研究 + 规划 + 验证阶段 1
/gsd-plan-phase 3 --skip-research   # 跳过研究直接规划（熟悉领域）
/gsd-plan-phase --auto              # 非交互式规划
/gsd-plan-phase 2 --validate        # 规划前验证状态
/gsd-plan-phase 1 --bounce          # 规划 + 外部 bounce 验证
```

---

### `/gsd-plan-review-convergence`

跨 AI 计划收敛循环。运行 `plan-phase → review → replan → re-review`，直到不再存在 HIGH 级别问题（默认最多 3 轮）。会为规划和评审分别启动隔离代理；编排器负责循环控制、HIGH 计数、停滞检测和升级处理。

| 参数 / 标志 | 必需 | 说明 |
|-----------------|----------|-------------|
| `N` | **是** | 要规划和评审的阶段编号 |
| `--codex` / `--gemini` / `--claude` / `--opencode` | 否 | 选择单个评审器 |
| `--all` | 否 | 并行运行所有已配置的评审器 |
| `--max-cycles N` | 否 | 覆盖循环上限（默认 3） |

**退出行为：** 当 HIGH 计数降为 0 时退出。若多轮之间 HIGH 计数没有下降，会触发停滞检测警告。当达到 `--max-cycles` 且仍有 HIGH 问题时，会要求用户继续或手动复核。

```bash
/gsd-plan-review-convergence 3                    # 默认评审器，3 轮
/gsd-plan-review-convergence 3 --codex            # 仅 Codex 评审
/gsd-plan-review-convergence 3 --all --max-cycles 5
```
