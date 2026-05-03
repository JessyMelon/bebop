# GSD 功能参考

> 功能与能力的完整说明。架构细节请参阅 [ARCHITECTURE.md](ARCHITECTURE.md)，命令语法请参阅 [COMMANDS.md](COMMANDS.md)。

---

## 目录

- [核心功能](#核心功能)
  - [1. 项目初始化](#1-项目初始化)
  - [2. 阶段讨论](#2-阶段讨论)
  - [3. UI 设计契约](#3-ui-设计契约)
  - [4. 阶段规划](#4-阶段规划)
  - [5. 阶段执行](#5-阶段执行)
  - [6. 工作验证](#6-工作验证)
  - [7. UI 审核](#7-ui-审核)
  - [8. 里程碑管理](#8-里程碑管理)
- [规划功能](#规划功能)
  - [9. 阶段管理](#9-阶段管理)
  - [10. 快速模式](#10-快速模式)
  - [11. 自主模式](#11-自主模式)
  - [12. 自由文本路由](#12-自由文本路由)
  - [13. 笔记捕获](#13-笔记捕获)
  - [14. 自动推进（Next）](#14-自动推进next)
- [质量保证功能](#质量保证功能)
  - [15. Nyquist 验证](#15-nyquist-验证)
  - [16. 计划检查](#16-计划检查)
  - [17. 执行后验证](#17-执行后验证)
  - [18. Node Repair](#18-node-repair)
  - [19. 健康校验](#19-健康校验)
  - [20. 跨阶段回归门禁](#20-跨阶段回归门禁)
  - [21. 需求覆盖门禁](#21-需求覆盖门禁)
- [上下文工程功能](#上下文工程功能)
  - [22. 上下文窗口监控](#22-上下文窗口监控)
  - [23. 会话管理](#23-会话管理)
  - [24. 会话报告](#24-会话报告)
  - [25. 多代理编排](#25-多代理编排)
  - [26. 模型 Profiles](#26-模型-profiles)
- [Brownfield 功能](#brownfield-功能)
  - [27. 代码库映射](#27-代码库映射)
- [实用功能](#实用功能)
  - [28. 调试系统](#28-调试系统)
  - [29. Todo 管理](#29-todo-管理)
  - [30. 统计面板](#30-统计面板)
  - [31. 更新系统](#31-更新系统)
  - [32. 设置管理](#32-设置管理)
  - [33. 测试生成](#33-测试生成)
- [基础设施功能](#基础设施功能)
  - [34. Git 集成](#34-git-集成)
  - [35. CLI 工具](#35-cli-工具)
  - [36. 多运行时支持](#36-多运行时支持)
  - [37. Hook 系统](#37-hook-系统)

---

## 核心功能

### 1. 项目初始化

**命令：** `/gsd-new-project [--auto @file.md]`

**目的：** 把用户想法转换为结构化项目，包含研究、需求和分阶段路线图。

**关键要求：**
- 自适应提问直到范围明确
- 并行研究领域生态
- 提取 v1 / v2 / out-of-scope 需求
- 生成可追踪到需求的路线图
- 路线图必须经用户批准
- 若已存在 `.planning/PROJECT.md`，禁止重复初始化

**产出：** `PROJECT.md`、`REQUIREMENTS.md`、`ROADMAP.md`、`STATE.md`、`config.json`、`research/`

### 2. 阶段讨论

**命令：** `/gsd-discuss-phase [N] [--auto] [--batch]`

**目的：** 在研究和规划前收集实现偏好，消除 AI 容易猜测的灰区。

**关键要求：**
- 分析阶段范围并识别灰区
- 只问之前 CONTEXT.md 没回答的问题
- 将决策持久化到 `{phase}-CONTEXT.md`
- 支持 `--auto` 和 `--batch`
- 先侦察相关源码再提问

**灰区类型：**
- 视觉功能：布局、密度、交互、空状态
- API/CLI：响应格式、标志、错误处理、详细程度
- 内容系统：结构、语气、深度、流程
- 组织任务：分组、命名、重复项、例外

### 3. UI 设计契约

**命令：** `/gsd-ui-phase [N]`

**目的：** 在规划前锁定设计标准，让同一阶段的组件保持一致视觉语言。

**关键要求：**
- 检测现有设计系统状态
- 只问未回答的设计契约问题
- 按 6 个维度校验
- 若 BLOCKED 则进入修订循环（最多 2 次）
- React/Next.js/Vite 项目可引导 shadcn 初始化
- 强制第三方 shadcn 组件的注册表安全门禁

**6 个校验维度：** Copywriting、Visuals、Color、Typography、Spacing、Registry Safety

### 4. 阶段规划

**命令：** `/gsd-plan-phase [N] [--auto] [--skip-research] [--skip-verify]`

**目的：** 调研实现领域并生成可执行、原子化的计划。

**关键要求：**
- 启动 phase researcher
- 每个计划 2-3 个任务，适合单个上下文窗口
- 计划必须使用 XML `<task>` 结构
- 每个计划都要有 `read_first` 和 `acceptance_criteria`
- 默认运行 plan checker 验证循环
- 前端阶段未配置 UI-SPEC 时要提示先做 UI phase
- 启用 Nyquist 时要包含测试映射
- 计划结束前必须覆盖所有阶段需求

### 5. 阶段执行

**命令：** `/gsd-execute-phase <N>`

**目的：** 使用 wave 并行模型执行阶段计划，每个执行器都拥有全新上下文。

**关键要求：**
- 分析依赖并分波次执行
- 波次内并行，波次间顺序
- 每个执行器都有 200K 级别新上下文
- 每个任务原子提交 git
- 每个计划产出 SUMMARY.md
- 执行后运行 verifier
- 支持 git branching strategy
- 失败时可触发 node repair
- 验证前先跑前序阶段测试，防回归

### 6. 工作验证

**命令：** `/gsd-verify-work [N]`

**目的：** 以 UAT 方式逐项验证交付物，并自动诊断失败。

### 7. UI 审核

**命令：** `/gsd-ui-review [N]`

**目的：** 对已实现前端做 6 支柱视觉审计，可独立运行。

### 8. 里程碑管理

**命令：** `/gsd-audit-milestone`、`/gsd-complete-milestone`、`/gsd-new-milestone [name]`

**目的：** 审计里程碑、归档、打 tag，并进入下一个周期。

---

## 规划功能

### 9. 阶段管理

**命令：** `/gsd-add-phase`、`/gsd-insert-phase [N]`、`/gsd-remove-phase [N]`

**目的：** 开发过程中动态修改路线图。

### 10. 快速模式

**命令：** `/gsd-quick [--full] [--discuss] [--research]`

**目的：** 保持 GSD 的保证，但走更快路径处理临时任务。

### 11. 自主模式

**命令：** `/gsd-autonomous [--from N]`

**目的：** 按路线图顺序自动跑完剩余阶段。

### 12. 自由文本路由

**命令：** `/gsd-do`

**目的：** 解析自然语言并路由到合适的 GSD 命令。

### 13. 笔记捕获

**命令：** `/gsd-note`

**目的：** 零打扰记录想法，支持追加、列表和转 todo。

### 14. 自动推进（Next）

**命令：** `/gsd-next`

**目的：** 自动判断当前项目状态并推进到下一步。

---

## 质量保证功能

### 15. Nyquist 验证

**目的：** 在写代码前把自动化测试覆盖映射到需求。

### 16. 计划检查

**目的：** 反向验证计划能否实现阶段目标。

### 17. 执行后验证

**目的：** 检查代码库是否真的实现了阶段承诺。

### 18. Node Repair

**目的：** 执行期间任务失败时自动恢复。

### 19. 健康校验

**命令：** `/gsd-health [--repair]`

**目的：** 检查 `.planning/` 完整性并可选自动修复。

### 20. 跨阶段回归门禁

**目的：** 执行完一个阶段后，运行之前阶段的测试套件，防止回归累积。

### 21. 需求覆盖门禁

**目的：** 在规划结束前确保每条阶段需求都至少被一个计划覆盖。

---

## 上下文工程功能

### 22. 上下文窗口监控

**目的：** 在上下文接近耗尽时提醒用户和代理，避免 context rot。

### 23. 会话管理

**命令：** `/gsd-pause-work`、`/gsd-resume-work`、`/gsd-progress`

**目的：** 在上下文重置和跨会话时保持项目连续性。

### 24. 会话报告

**命令：** `/gsd-session-report`

**目的：** 生成结构化会后总结，记录做了什么、结果如何、消耗多少。

### 25. 多代理编排

**目的：** 为每个任务协调拥有新上下文窗口的专门代理。

### 26. 模型 Profiles

**命令：** `/gsd-set-profile <quality|balanced|budget|inherit>`

**目的：** 为每个代理选择模型等级，在质量和成本之间平衡。

---

## Brownfield 功能

### 27. 代码库映射

**命令：** `/gsd-map-codebase [area] [--repos repo-a,repo-b]`

**目的：** 在开始新项目前分析已有代码库，让 GSD 先理解现状。

**产出：** `STACK.md`、`ARCHITECTURE.md`、`CONVENTIONS.md`、`CONCERNS.md`、`STRUCTURE.md`、`TESTING.md`、`INTEGRATIONS.md`

**范围更新：** 使用 `--repos` 时，只更新指定仓库相关内容，并保留 `.planning/codebase/` 中其他仓库的已有分析。

---

## 实用功能

### 28. 调试系统

**命令：** `/gsd-debug [description]`

**目的：** 通过持久状态进行系统化调试，跨上下文重置持续存在。

### 29. Todo 管理

**命令：** `/gsd-add-todo [desc]`、`/gsd-check-todos`

**目的：** 在会话中捕获后续工作。

### 30. 统计面板

**命令：** `/gsd-stats`

**目的：** 显示阶段、计划、需求、git 历史和时间线指标。

### 31. 更新系统

**命令：** `/gsd-update`

**目的：** 更新到最新版并预览更新日志。

### 32. 设置管理

**命令：** `/gsd-settings`

**目的：** 交互式配置工作流开关和模型 profile。

### 33. 测试生成

**命令：** `/gsd-add-tests [N]`

**目的：** 为完成的阶段生成测试。

---

## 基础设施功能

### 34. Git 集成

**目的：** 原子提交、分支策略和清晰历史管理。

### 35. CLI 工具

**目的：** 为工作流和代理提供程序化工具，替代重复的 inline bash。

### 36. 多运行时支持

**目的：** 让 GSD 可运行于多个 AI 编码代理运行时。

### 37. Hook 系统

**目的：** 提供上下文监控、状态展示和更新检查的运行时事件 hooks。

### 38. 开发者画像

**命令：** `/gsd-profile-user [--questionnaire] [--refresh]`

**目的：** 分析 Claude Code 会话历史，从 8 个维度构建行为画像，让 Claude 的回复更贴合开发者风格。

**维度：**
1. 沟通风格
2. 决策模式
3. 调试方式
4. UX 偏好
5. 厂商/技术选择
6. 触发烦躁的点
7. 学习风格
8. 解释深度

### 39. 执行加固

**目的：** 给执行流水线增加三层质量改进，在跨计划失败扩散前就抓住它们。

**组件：**
- 波次前依赖检查
- 跨计划数据契约第 9 维度
- 导出级抽查

### 40. 验证债务跟踪

**命令：** `/gsd-audit-uat`

**目的：** 防止项目推进到后续阶段时，把未完成的 UAT/验证项静默丢失。

**组件：**
- 跨阶段健康检查
- `status: partial`
- `result: blocked` 和 `blocked_by`
- HUMAN-UAT.md 持久化
- 阶段完成警告

---

## v1.27 功能

### 41. Fast Mode

**命令：** `/gsd-fast [task description]`

**目的：** 不启用子代理、不生成 PLAN.md，直接内联执行很小的任务。

### 42. 跨 AI 同行评审

**命令：** `/gsd-review --phase N [--gemini] [--claude] [--codex] [--coderabbit] [--opencode] [--qwen] [--cursor] [--all]`

**目的：** 调用外部 AI CLI 独立审查阶段计划，产出 `REVIEWS.md`。

### 43. Backlog 停车区

**命令：** `/gsd-add-backlog`、`/gsd-review-backlog`、`/gsd-plant-seed`

**目的：** 收纳暂时不适合主动规划的想法。

### 44. 持久上下文 Threads

**命令：** `/gsd-thread [name | description]`

**目的：** 为跨会话、但不属于某个具体阶段的工作提供轻量知识存储。

### 45. PR 分支过滤

**命令：** `/gsd-pr-branch [target branch]`

**目的：** 生成一个适合 PR 的干净分支，过滤掉 `.planning/` 提交。

### 46. 安全加固

**目的：** 为规划工件提供分层防御，防 prompt injection 和路径穿越。

### 47. 多仓库工作空间支持

**目的：** 支持 monorepo 和多仓库工作区，自动解析项目根。

### 48. 讨论审计轨迹

**目的：** 在 `/gsd-discuss-phase` 期间自动生成 `DISCUSSION-LOG.md`，保留完整审计轨迹。

---

## v1.28 功能

### 49. Forensics

**命令：** `/gsd-forensics [description]`

**目的：** 对失败或卡住的 GSD 工作流做事后调查。

### 50. Milestone Summary

**命令：** `/gsd-milestone-summary [version]`

**目的：** 从里程碑工件生成适合团队入场的综合总结。

### 51. Workstream Namespacing

**命令：** `/gsd-workstreams`

**目的：** 为不同里程碑区域的并行工作提供隔离命名空间。

### 52. Manager Dashboard

**命令：** `/gsd-manager`

**目的：** 在一个终端中管理多个阶段的交互式指挥台。

### 53. 假设讨论模式

**命令：** `/gsd-discuss-phase` 搭配 `workflow.discuss_mode: 'assumptions'`

**目的：** 用代码库优先的假设分析代替访谈式提问。

### 54. UI 阶段自动检测

**作用于：** `/gsd-new-project` 和 `/gsd-progress`

**目的：** 自动识别 UI 密集型项目，并提示 `/gsd-ui-phase`。

### 55. 多运行时安装选择

**作用于：** `npx get-shit-done-cc`

**目的：** 在一次交互中选择多个运行时。

---

## v1.29 功能

### 56. Windsurf 运行时支持

### 57. 国际化文档

**目的：** 提供葡语、韩语和日语文档。

---

## v1.30 功能

### 58. GSD SDK

**目的：** 提供可编程的无头 TypeScript SDK。

---

## v1.31 功能

### 59. Schema 漂移检测

### 60. 安全强制

### 61. 文档生成

### 62. Discuss Chain 模式

### 63. 单阶段自主执行

### 64. 范围缩减检测

### 65. 断言来源标记

### 66. Worktree 开关

### 67. 项目代码前缀

### 68. Claude Code Skills 迁移

---

## v1.32 功能

### 69. STATE.md 一致性门禁

### 70. 自主模式 `--to N`

### 71. 研究门禁

### 72. Verifier 里程碑范围过滤

### 73. 先读后改守卫 Hook

### 74. 上下文缩减

### 75. Discuss-phase `--power`

### 76. Debug `--diagnose`

**命令：** `/gsd-debug --diagnose`

**目的：** 只做诊断，不尝试修复。

### 77. 阶段依赖分析

**命令：** `/gsd-analyze-dependencies`

**目的：** 在运行 `/gsd-manager` 前，检测阶段依赖并建议写入 ROADMAP.md 的 `Depends on` 条目。

### 78. 反模式严重度等级

**作用于：** `/gsd-resume-work`

**目的：** 在恢复会话时按严重度强制理解检查。

### 79. 方法学工件类型

**目的：** 为方法学文档定义独立的工件类型和消费机制。

### 80. 规划器可达性检查

**作用于：** `/gsd-plan-phase`

**目的：** 在提交执行前验证计划步骤是否可达。

### 81. Playwright-MCP UI 验证

**作用于：** `/gsd-verify-work`（可选）

**目的：** 在验证阶段启用自动视觉验证。

### 82. Pause-Work 扩展

**作用于：** `/gsd-pause-work`

**目的：** 支持快速任务、调试会话和 threads 等非阶段上下文的更丰富交接。

### 83. 回复语言配置

**配置：** `response_language`

**目的：** 为非英文用户提供跨阶段语言一致性。

### 84. 手动更新流程

**作用于：** `docs/manual-update.md`

**目的：** 为 npm 不可用的环境提供手动更新路径。

### 85. 新运行时支持（Trae、Cline、Augment Code）

**作用于：** `npx get-shit-done-cc`

**目的：** 扩展到 Trae、Cline 和 Augment Code 运行时。

### 86. 自主 `--interactive` 标志

**作用于：** `/gsd-autonomous --interactive`

**目的：** 让 discuss-phase 保持交互式，但把 plan 和 execute 放到后台代理。

### 87. Commit-Docs 守卫 Hook

**Hook：** `gsd-commit-docs.js`

**目的：** 当 `planning.commit_docs` 为 false 时，阻止提交 `.planning/` 文件。

### 88. 社区 Hooks 选择加入

**Hooks：** `gsd-validate-commit.sh`、`gsd-session-state.sh`、`gsd-phase-boundary.sh`

**目的：** 通过配置显式启用的可选 git 和会话 hooks。

---

## v1.34.0 功能

### 89. 全局学习存储

**配置：** `features.global_learnings`

**目的：** 把跨会话、跨项目的学习沉淀到全局存储，让 planner 可以复用历史模式。

### 90. 可查询的代码库智能

**命令：** `/gsd-intel [query <term>|status|diff|refresh]`

**目的：** 在 `.planning/intel/` 中维护可查询的 JSON 索引。

### 91. 执行上下文 Profiles

**配置：** `context_profile`

**目的：** 用预设上下文快速切换适合不同工作类型的模式、模型和工作流设置。

### 92. 门禁分类法

**参考：** `references/gates.md`

**目的：** 定义四种门禁类型，统一工作流各检查点逻辑。

### 93. 代码审查流水线

**命令：** `/gsd-code-review`、`/gsd-code-review-fix`

**目的：** 对阶段内变更做结构化审查，并提供独立自动修复流程。

### 94. 苏格拉底式探索

**命令：** `/gsd-explore [topic]`

**目的：** 在定计划前通过提问引导开发者探索想法。

### 95. 安全撤销

**命令：** `/gsd-undo --last N | --phase NN | --plan NN-MM`

**目的：** 通过阶段清单和 git log 安全回滚提交。

### 96. 计划导入

**命令：** `/gsd-import --from <filepath>`

**目的：** 将外部计划导入 GSD，并与 PROJECT.md 决策做冲突检测。

### 97. 快速代码库扫描

**命令：** `/gsd-scan [--focus tech|arch|quality|concerns|tech+arch]`

**目的：** 轻量版代码库映射，只启动一个 mapper 代理。

### 98. 自主 Audit-to-Fix

**命令：** `/gsd-audit-fix [--source <audit>] [--severity high|medium|all] [--max N] [--dry-run]`

**目的：** 审计、分类、自动修复、测试和原子提交的一体化流水线。

### 99. 增强版 Prompt Injection 扫描器

**Hook：** `gsd-prompt-guard.js`

**脚本：** `scripts/prompt-injection-scan.sh`

**目的：** 增强检测不可见 Unicode、编码混淆和高熵可疑字符串。

### 100. 计划阶段停滞检测

**命令：** `/gsd-plan-phase`

**目的：** 检测 planner 反复输出同样结果的停滞循环，并切换策略或退出。

### 101. `/gsd-next` 硬停止安全门禁

**命令：** `/gsd-next`

**目的：** 防止 `/gsd-next` 进入死循环，重复相同步骤时强制确认。

### 102. 自适应模型预设

**配置：** `model_profile: "adaptive"`

**目的：** 根据代理角色自动选择合适的模型等级。

### 103. 合并后 hunk 验证

**命令：** `/gsd-reapply-patches`

**目的：** 更新后验证每个补丁 hunk 是否真正应用成功。

---

## v1.35.0 功能

### 104. 新运行时支持（Cline、CodeBuddy、Qwen Code）

### 105. GSD-2 反向迁移

### 106. AI 集成阶段向导

### 107. AI Eval Review

---

## v1.36.0 功能

### 108. Plan Bounce

### 109. 外部代码审查命令

### 110. 跨 AI 执行委派

### 111. 架构责任映射

### 112. 提取学习

### 113. SDK Workstream 支持

### 114. 上下文窗口感知的提示压缩

### 115. 可配置 CLAUDE.md 路径

### 116. TDD 流水线模式

---

## v1.37.0 功能

### 117. Spike 命令

### 118. Sketch 命令

### 119. 代理大小预算强制

### 120. 共享样板抽取

### 121. 知识图谱集成
