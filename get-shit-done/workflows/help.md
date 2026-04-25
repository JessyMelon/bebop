<purpose>
显示完整的 GSD 命令参考。输出 ONLY 参考内容本身。不要添加项目分析、git 状态、下一步建议或任何参考之外的说明。
</purpose>

<reference>
# GSD 命令参考

**GSD**（Get Shit Done）会创建分层项目计划，专门面向单人 agentic 开发流程优化。

## 快速开始

1. `/gsd-new-project` - 初始化项目（包含研究、需求、路线图）
2. `/gsd-plan-phase 1` - 为第一阶段创建详细计划
3. `/gsd-execute-phase 1` - 执行该阶段

## 保持更新

GSD 迭代很快，建议定期更新：

```bash
npx get-shit-done-cc@latest
```

## 核心工作流

```text
/gsd-new-project → /gsd-plan-phase → /gsd-execute-phase → 重复
```

### 项目初始化

**`/gsd-new-project`**
通过统一流程初始化新项目。

一条命令把你从想法带到可规划状态：
- 深度提问，理解你到底要构建什么
- 可选的领域研究（启动 4 个并行研究代理）
- 需求定义，划分 v1 / v2 / 范围外
- 路线图创建，包含阶段拆分和成功标准

会创建完整 `.planning/` 工件：
- `PROJECT.md` - 项目愿景和需求
- `config.json` - 工作流模式（interactive / yolo）
- `research/` - 领域研究（如果选择）
- `REQUIREMENTS.md` - 带 REQ-ID 的范围化需求
- `ROADMAP.md` - 映射到需求的阶段
- `STATE.md` - 项目记忆

用法：`/gsd-new-project`

**`/gsd-map-codebase`**
为现有代码库项目建立 brownfield 地图。

- 用并行 Explore 代理分析代码库
- 在 `.planning/codebase/` 下创建 7 份聚焦文档
- 覆盖技术栈、架构、结构、约定、测试、集成、风险点
- 在现有代码库上运行 `/gsd-new-project` 前先用它

用法：`/gsd-map-codebase`

### 阶段规划

**`/gsd-discuss-phase <number>`**
在规划前帮助你表达对某个阶段的预期。

- 捕获你希望该阶段如何工作
- 创建 `CONTEXT.md`，记录愿景、关键点和边界
- 当你已经对实现效果或体验有想法时使用
- 可选 `--batch`，一次问 2-5 个相关问题，而不是逐个问

用法：`/gsd-discuss-phase 2`
用法：`/gsd-discuss-phase 2 --batch`
用法：`/gsd-discuss-phase 2 --batch=3`

**`/gsd-research-phase <number>`**
仅做复杂/冷门领域的深度生态研究。

- 识别标准技术栈、架构模式和常见陷阱
- 创建 `RESEARCH.md`，沉淀“专家通常怎么做”
- 适用于 3D、游戏、音频、shader、ML 等专门领域
- 不只是“选哪个库”，而是整套生态知识

用法：`/gsd-research-phase 3`

**`/gsd-list-phase-assumptions <number>`**
在 Claude 开始规划前，先看它准备怎么做。

- 展示 Claude 对该阶段的预期方案
- 如果它误解了你的意图，可以提前纠偏
- 不会创建文件，只是对话输出

用法：`/gsd-list-phase-assumptions 3`

**`/gsd-plan-phase <number>`**
为指定阶段创建详细执行计划。

- 生成 `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- 把阶段拆成具体、可执行的任务
- 包含验证标准和成功条件
- 支持一个阶段多个计划（XX-01、XX-02 等）

用法：`/gsd-plan-phase 1`
结果：创建 `.planning/phases/01-foundation/01-01-PLAN.md`

**PRD 快速路径：** 传入 `--prd path/to/requirements.md` 可以完全跳过 discuss-phase。你的 PRD 会被当作 CONTEXT.md 中的锁定决策。适合你已经有清晰验收标准时使用。

### 执行

**`/gsd-execute-phase <phase-number>`**
执行某个阶段的全部计划，或只执行指定 wave。

- 按 frontmatter 中的 wave 分组，按 wave 顺序执行
- 同一 wave 内的计划通过 Task 工具并行运行
- 可选 `--wave N` 只执行第 N 个 wave，除非该阶段因此已完成
- 所有计划完成后验证阶段目标
- 更新 `REQUIREMENTS.md`、`ROADMAP.md`、`STATE.md`

用法：`/gsd-execute-phase 5`
用法：`/gsd-execute-phase 5 --wave 2`

### 智能路由

**`/gsd-do <description>`**
把自然语言自动路由到正确的 GSD 命令。

- 分析自然语言输入，找到最匹配的 GSD 命令
- 它只负责分发，不直接执行工作本身
- 如有歧义，会让你在几个候选项中选择
- 当你知道要做什么，但不知道该运行哪个 `/gsd-*` 命令时使用

用法：`/gsd-do fix the login button`
用法：`/gsd-do refactor the auth system`
用法：`/gsd-do I want to start a new milestone`

### Quick 模式

**`/gsd-quick [--full] [--validate] [--discuss] [--research]`**
为小型临时任务提供带 GSD 保障的快速路径，同时跳过部分可选代理。

Quick 模式使用同一套系统，但路径更短：
- 启动 planner + executor（默认跳过 researcher、checker、verifier）
- Quick 任务存放在 `.planning/quick/`，和正式阶段分开
- 更新的是 `STATE.md` 跟踪，而不是 `ROADMAP.md`

标志可启用额外质量步骤：
- `--full` - 完整质量管线：discussion + research + plan-checking + verification
- `--validate` - 只做 plan-checking（最多 2 次迭代）和执行后验证
- `--discuss` - 轻量讨论，先暴露灰区
- `--research` - 规划前由聚焦研究代理先调查方案

这些标志可组合：`--discuss --research --validate` 等价于 `--full`。

用法：`/gsd-quick`
用法：`/gsd-quick --full`
用法：`/gsd-quick --research --validate`
结果：创建 `.planning/quick/NNN-slug/PLAN.md`、`.planning/quick/NNN-slug/SUMMARY.md`

---

**`/gsd-fast [description]`**
直接内联执行极小任务，不启动子代理、不生成计划文件、没有额外开销。

适合那些小到不值得走规划流程的任务：修 typo、改配置、补漏提交流程、小改动。它会在当前上下文里直接修改、提交，并记录到 `STATE.md`。

- 不创建 `PLAN.md` 或 `SUMMARY.md`
- 不启动子代理（直接内联执行）
- 超过 3 个文件编辑的复杂任务会引导改用 `/gsd-quick`
- 使用原子提交和规范化提交消息

用法：`/gsd-fast "fix the typo in README"`
用法：`/gsd-fast "add .env to gitignore"`

### 路线图管理

**`/gsd-add-phase <description>`**
在当前里程碑末尾追加新阶段。

- 追加到 `ROADMAP.md`
- 使用下一个顺序编号
- 更新阶段目录结构

用法：`/gsd-add-phase "Add admin dashboard"`

**`/gsd-insert-phase <after> <description>`**
在现有阶段之间插入一个十进制编号的紧急阶段。

- 创建中间阶段（例如在 7 和 8 之间插入 7.1）
- 适用于里程碑中途发现必须插队完成的工作
- 保持整体阶段顺序

用法：`/gsd-insert-phase 7 "Fix critical auth bug"`
结果：创建阶段 7.1

**`/gsd-remove-phase <number>`**
移除未来阶段，并重排后续阶段编号。

- 删除阶段目录和所有引用
- 重编号所有后续阶段，补上空缺
- 只允许删除未来、未开始的阶段
- 通过 git commit 保留历史记录

用法：`/gsd-remove-phase 17`
结果：删除阶段 17，原 18-20 变成 17-19

### 里程碑管理

**`/gsd-new-milestone <name>`**
通过统一流程开启新里程碑。

- 深度提问，理解你接下来要构建什么
- 可选领域研究（启动 4 个并行研究代理）
- 定义需求并划定范围
- 创建路线图和阶段拆分
- 可选 `--reset-phase-numbers` 会先安全归档旧阶段目录，再从阶段 1 重新编号

它本质上是 `/gsd-new-project` 在已有 `PROJECT.md` 的 brownfield 场景中的镜像流程。

用法：`/gsd-new-milestone "v2.0 Features"`
用法：`/gsd-new-milestone --reset-phase-numbers "v2.0 Features"`

**`/gsd-complete-milestone <version>`**
归档已完成里程碑，并为下个版本做准备。

- 在 `MILESTONES.md` 中创建里程碑条目和统计
- 把完整细节归档到 `milestones/` 目录
- 创建该版本的 git tag
- 为下一版本准备工作区

用法：`/gsd-complete-milestone 1.0.0`

### 进度跟踪

**`/gsd-progress`**
检查项目状态，并智能路由到下一个动作。

- 展示可视化进度条和完成百分比
- 从 `SUMMARY` 文件中总结最近工作
- 显示当前位置和下一步
- 列出关键决策和未解决问题
- 如果下一计划已具备条件，可直接提示执行
- 能检测到里程碑 100% 完成状态

用法：`/gsd-progress`

### 会话管理

**`/gsd-resume-work`**
从之前的会话恢复完整上下文。

- 读取 `STATE.md` 获得项目上下文
- 展示当前位置和最近进展
- 按项目状态提供下一步建议

用法：`/gsd-resume-work`

**`/gsd-pause-work`**
在阶段中途中断时，创建上下文交接。

- 创建 `.continue-here` 文件保存当前状态
- 更新 `STATE.md` 的会话连续性信息
- 捕获进行中的工作上下文

用法：`/gsd-pause-work`

### 调试

**`/gsd-debug [issue description]`**
支持跨上下文重置的系统化调试。

- 通过自适应提问收集症状
- 创建 `.planning/debug/[slug].md` 跟踪调查过程
- 用科学方法推进（证据 → 假设 → 测试）
- 即使 `/clear` 之后也能恢复，空参运行即可继续
- 已解决问题会归档到 `.planning/debug/resolved/`

用法：`/gsd-debug "login button doesn't work"`
用法：`/gsd-debug`（恢复当前调试会话）

### Spike 与 Sketch

**`/gsd-spike [idea] [--quick]`**
通过一次性实验快速验证一个技术想法的可行性。

- 把想法拆成 2-5 个聚焦实验，并按风险排序
- 每个 spike 只回答一个明确的 Given/When/Then 问题
- 写最小可运行代码，执行并给出结论（VALIDATED / INVALIDATED / PARTIAL）
- 保存到 `.planning/spikes/`，并由 `MANIFEST.md` 跟踪
- 不要求先运行 `/gsd-new-project`，任何仓库都能用
- `--quick` 跳过拆解步骤，直接开始实验

用法：`/gsd-spike "can we stream LLM output over WebSockets?"`
用法：`/gsd-spike --quick "test if pdfjs extracts tables"`

**`/gsd-sketch [idea] [--quick]`**
用一次性 HTML mockup 快速探索 UI / 设计方案，并比较多个变体。

- 先通过对话收集氛围和方向
- 每个 sketch 产出 2-3 个变体，以带标签的 HTML 页面形式展示
- 用户比较变体、挑选元素、继续迭代
- 共享 CSS 主题系统，会在多个 sketch 间复用和累积
- 保存到 `.planning/sketches/`，并由 `MANIFEST.md` 跟踪
- 不要求先运行 `/gsd-new-project`
- `--quick` 会跳过前置氛围收集，直接开始构建

用法：`/gsd-sketch "dashboard layout for the admin panel"`
用法：`/gsd-sketch --quick "form card grouping"`

**`/gsd-spike-wrap-up`**
把 spike 结果打包成可持续复用的项目技能。

- 逐个整理 spike（include / exclude / partial / UAT）
- 按功能区域分组
- 生成 `./.claude/skills/spike-findings-[project]/`
- 在 `.planning/spikes/WRAP-UP-SUMMARY.md` 写总结
- 在项目 CLAUDE.md 中加入自动加载路由行

用法：`/gsd-spike-wrap-up`

**`/gsd-sketch-wrap-up`**
把 sketch 的设计结论打包成可持续复用的项目技能。

- 逐个整理 sketch（include / exclude / partial / revisit）
- 按设计区域分组
- 生成 `./.claude/skills/sketch-findings-[project]/`
- 在 `.planning/sketches/WRAP-UP-SUMMARY.md` 写总结
- 在项目 CLAUDE.md 中加入自动加载路由行

用法：`/gsd-sketch-wrap-up`

### 快速笔记

**`/gsd-note <text>`**
零摩擦记录想法，一条命令、即时保存、没有追问。

- 带时间戳保存到 `.planning/notes/`（或全局 `~/.claude/notes/`）
- 三个子命令：append（默认）、list、promote
- promote 会把笔记变成结构化 todo
- 即使没有项目也能使用（自动回退到全局作用域）

用法：`/gsd-note refactor the hook system`
用法：`/gsd-note list`
用法：`/gsd-note promote 3`
用法：`/gsd-note --global cross-project idea`

### Todo 管理

**`/gsd-add-todo [description]`**
把当前对话里的想法或任务提炼成 todo。

- 从当前对话提取上下文（或直接用传入描述）
- 在 `.planning/todos/pending/` 下创建结构化 todo 文件
- 会根据文件路径推断归属区域，方便分组
- 创建前检查重复项
- 更新 `STATE.md` 中的 todo 计数

用法：`/gsd-add-todo`（从当前对话推断）
用法：`/gsd-add-todo Add auth token refresh`

**`/gsd-check-todos [area]`**
列出待处理 todo，并选择一个开始做。

- 列出所有待办，包含标题、区域、创建时间
- 可选按区域筛选（例如 `/gsd-check-todos api`）
- 加载选中 todo 的完整上下文
- 根据情况路由到对应动作（立即处理、加入阶段、继续讨论）
- 一旦开始处理，会把 todo 移到 `done/`

用法：`/gsd-check-todos`
用法：`/gsd-check-todos api`

### 用户验收测试

**`/gsd-verify-work [phase]`**
通过对话式 UAT 验证已交付功能。

- 从 `SUMMARY.md` 中提取可测试交付物
- 一次展示一个测试项（yes / no）
- 如果失败，会自动诊断并创建修复计划
- 如有问题，准备好再次执行

用法：`/gsd-verify-work 3`

### Ship 工作

**`/gsd-ship [phase]`**
基于完成的阶段工作创建 PR，并自动生成 PR 正文。

- 把当前分支推送到远端
- 从 `SUMMARY.md`、`VERIFICATION.md`、`REQUIREMENTS.md` 生成 PR 摘要
- 可选请求代码审查
- 更新 `STATE.md` 中的 ship 状态

前提条件：该阶段已经验证通过，且已安装并认证 `gh` CLI。

用法：`/gsd-ship 4`
用法：`/gsd-ship 4 --draft`

---

**`/gsd-review --phase N [--gemini] [--claude] [--codex] [--coderabbit] [--opencode] [--qwen] [--cursor] [--all]`**
跨 AI 同行评审，调用外部 AI CLI 独立评审阶段计划。

- 检测可用 CLI（gemini、claude、codex、coderabbit 等）
- 每个 CLI 用相同结构化提示独立审查计划
- CodeRabbit 会审当前 git diff，而不是提示词，可能需要几分钟
- 产出 `REVIEWS.md`，包含每位评审者反馈和共识总结
- 评审结果可回流到规划：`/gsd-plan-phase N --reviews`

用法：`/gsd-review --phase 3 --all`

---

**`/gsd-pr-branch [target]`**
通过过滤掉 `.planning/` 提交来生成干净的 PR 分支。

- 把提交分为：纯代码（保留）、纯规划（排除）、混合提交（只保留非 `.planning/` 部分）
- 把代码提交 cherry-pick 到干净分支
- 评审者只会看到代码变化，不会看到 GSD 工件

用法：`/gsd-pr-branch`
用法：`/gsd-pr-branch main`

---

**`/gsd-plant-seed [idea]`**
记录一个带触发条件的前瞻性想法，后续自动浮现。

- Seed 会保留 WHY、WHEN 和相关代码线索
- 在 `/gsd-new-milestone` 时，如果触发条件匹配，会自动呈现
- 比 deferred items 更可靠，因为它会被检查，而不是被遗忘

用法：`/gsd-plant-seed "add real-time notifications when we build the events system"`

---

**`/gsd-audit-uat`**
跨阶段审计所有未完成的 UAT 和验证项。

- 扫描每个阶段里的 pending、skipped、blocked、human_needed 项
- 结合代码库检查过时文档
- 生成按可测试性分组的优先人类测试计划
- 适合在开始新里程碑前清理验证债务

用法：`/gsd-audit-uat`

### 里程碑审计

**`/gsd-audit-milestone [version]`**
对照最初目标审计里程碑完成情况。

- 读取所有阶段的 `VERIFICATION.md`
- 检查需求覆盖率
- 启动 integration checker 检查跨阶段连线
- 创建 `MILESTONE-AUDIT.md`，列出缺口和技术债

用法：`/gsd-audit-milestone`

**`/gsd-plan-milestone-gaps`**
为审计发现的缺口创建新阶段。

- 读取 `MILESTONE-AUDIT.md` 并把缺口分组到阶段
- 按需求优先级（must / should / nice）排序
- 把缺口关闭阶段加入 `ROADMAP.md`
- 生成的新阶段可立即进入 `/gsd-plan-phase`

用法：`/gsd-plan-milestone-gaps`

### 配置

**`/gsd-settings`**
交互式配置工作流开关和模型 profile。

- 开关 researcher、plan checker、verifier 等代理
- 选择模型 profile（quality / balanced / budget / inherit）
- 更新 `.planning/config.json`

用法：`/gsd-settings`

**`/gsd-set-profile <profile>`**
快速切换 GSD 代理使用的模型 profile。

- `quality` - 几乎全程使用更高质量模型
- `balanced` - 规划优先质量，执行更平衡（默认）
- `budget` - 写作和执行更省成本
- `inherit` - 所有代理都继承当前会话模型

用法：`/gsd-set-profile budget`

### 工具命令

**`/gsd-cleanup`**
归档已完成里程碑的阶段目录，减少当前 `.planning/phases/` 的杂乱程度。

- 识别已完成里程碑但仍留在 `.planning/phases/` 下的阶段
- 在真正移动前展示 dry-run 摘要
- 把阶段目录移动到 `.planning/milestones/v{X.Y}-phases/`
- 适合多个里程碑后做一次清理

用法：`/gsd-cleanup`

**`/gsd-help`**
显示当前这份命令参考。

**`/gsd-update`**
更新到最新版 GSD，并预览 changelog。

- 对比当前已安装版本和最新版本
- 展示你错过的 changelog 条目
- 高亮 breaking changes
- 运行安装前先确认
- 比直接裸跑 `npx get-shit-done-cc` 更安全

用法：`/gsd-update`

**`/gsd-join-discord`**
加入 GSD Discord 社区。

- 提问、展示你在构建什么、获取更新
- 和其他 GSD 用户交流

用法：`/gsd-join-discord`

## 文件与结构

```text
.planning/
├── PROJECT.md            # 项目愿景
├── ROADMAP.md            # 当前阶段拆分
├── STATE.md              # 项目记忆与上下文
├── RETROSPECTIVE.md      # 持续回顾（每个里程碑更新）
├── config.json           # 工作流模式与门禁
├── todos/
│   ├── pending/          # 待处理 todo
│   └── done/             # 已完成 todo
├── spikes/
│   ├── MANIFEST.md       # Spike 清单和结论
│   └── NNN-name/         # 单个 spike 目录
├── sketches/
│   ├── MANIFEST.md       # Sketch 清单和胜出项
│   ├── themes/           # 共享 CSS 主题文件
│   └── NNN-name/         # 单个 sketch 目录（HTML + README）
├── debug/
│   └── resolved/         # 已归档的问题
├── milestones/
│   ├── v1.0-ROADMAP.md       # 归档路线图快照
│   ├── v1.0-REQUIREMENTS.md  # 归档需求
│   └── v1.0-phases/          # 归档阶段目录
├── codebase/
│   ├── STACK.md          # 语言、框架、依赖
│   ├── ARCHITECTURE.md   # 模式、层次、数据流
│   ├── STRUCTURE.md      # 目录结构、关键文件
│   ├── CONVENTIONS.md    # 编码约定、命名规范
│   ├── TESTING.md        # 测试设置与模式
│   ├── INTEGRATIONS.md   # 外部服务与 API
│   └── CONCERNS.md       # 技术债和已知问题
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## 工作流模式

在 `/gsd-new-project` 期间设置：

**Interactive 模式**

- 对每个主要决策都进行确认
- 在检查点停下来等待批准
- 整体引导更多

**YOLO 模式**

- 自动批准大部分决策
- 无需确认直接执行计划
- 只在关键检查点停下

你可以随时编辑 `.planning/config.json` 来切换。

## 规划配置

在 `.planning/config.json` 中配置如何管理规划工件：

**`planning.commit_docs`**（默认：`true`）
- `true`：规划工件会提交到 git（标准工作流）
- `false`：规划工件仅保留本地，不提交

当 `commit_docs: false` 时：
- 把 `.planning/` 加入 `.gitignore`
- 适合 OSS 贡献、客户项目或你想保持规划私有的情况
- 所有规划文件仍可正常使用，只是不进入 git

**`planning.search_gitignored`**（默认：`false`）
- `true`：大范围 ripgrep 搜索时追加 `--no-ignore`
- 只有当 `.planning/` 已被 gitignore，且你仍想在全项目搜索里包含它时才需要

示例配置：
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

## 常见工作流

**开始一个新项目：**

```text
/gsd-new-project
/clear
/gsd-plan-phase 1
/clear
/gsd-execute-phase 1
```

**中断一段时间后恢复：**

```text
/gsd-progress
```

**里程碑中途插入紧急工作：**

```text
/gsd-insert-phase 5 "Critical security fix"
/gsd-plan-phase 5.1
/gsd-execute-phase 5.1
```

**完成一个里程碑：**

```text
/gsd-complete-milestone 1.0.0
/clear
/gsd-new-milestone
```

**工作中途记录想法：**

```text
/gsd-add-todo
/gsd-add-todo Fix modal z-index
/gsd-check-todos
/gsd-check-todos api
```

**调试一个问题：**

```text
/gsd-debug "form submission fails silently"
# ... 调查进行中，上下文逐渐变满 ...
/clear
/gsd-debug
```

## 获取帮助

- 读 `.planning/PROJECT.md` 看项目愿景
- 读 `.planning/STATE.md` 看当前上下文
- 看 `.planning/ROADMAP.md` 了解阶段状态
- 运行 `/gsd-progress` 看自己推进到哪了
</reference>
