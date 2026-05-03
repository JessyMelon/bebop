# 工作流升级计划

## 目标

将 `coder-llm-wiki` 从“证据驱动的文档目录结构”升级为“可重复执行、可校验、可恢复的仓库知识生产工作流”。

目标不是复制 `get-shit-done` 的全部复杂度，而是吸收其最有效的机制：
- 明确阶段边界
- 明确输入输出
- 明确质量门
- 明确状态流转
- 明确命令入口

## 当前状态

`coder-llm-wiki` 当前已经具备良好的基础：
- 有稳定目录结构：`README.md`
- 有项目章程和证据规则：`00-meta/project-charter.md`
- 有执行清单：`00-meta/opencode-dispatch-checklist.md`
- 有 prompt 模板：`00-meta/prompt-templates.md`
- 有进度和任务队列：`00-meta/progress.json`、`00-meta/task-queue.json`
- 有模块、流程、证据、风险、运维等模板

当前主要短板：
- 更像人工 runbook，不像标准化工作流接口
- 阶段定义存在，但缺少进入条件、退出条件、失败处理
- review 是事后动作，缺少前置质量门
- 状态模型较粗，难以稳定恢复长任务
- 缺少面向读者的总览与覆盖率视图

## 设计原则

沿用当前 wiki 的核心原则，并补充流程化约束：

1. 证据优先，结论必须可回溯。
2. 事实、推断、问题三者分离。
3. 小步更新，禁止大范围重写。
4. 每个阶段必须有明确产物。
5. 每个阶段必须有通过标准。
6. 每次任务都必须可恢复。
7. 文档不仅要能写出来，还要能被下一步消费。

## 目标工作流

建议将工作流明确为 8 个阶段。

### 1. 初始化

目的：初始化 wiki 运行上下文。

输入：
- 仓库目录
- `coder-llm-wiki/00-meta/project-charter.md`

输出：
- 初始化后的 `progress.json`
- 初始化后的 `task-queue.json`
- 如有必要，补充 `glossary.md`

进入条件：
- `coder-llm-wiki/` 目录存在

退出条件：
- 当前分析轮次已定义 phase
- 队列中存在首批任务

### 2. Inventory

目的：建立仓库一级认知地图。

输出：
- `01-inventory/repo-map.md`
- `01-inventory/tech-stack.md`
- `01-inventory/entrypoints.md`
- `01-inventory/module-candidates.json`

退出条件：
- 顶层目录职责明确
- 主要入口已识别
- 模块候选列表可供下一阶段消费

### 3. Index

目的：建立可检索索引层。

输出：
- `02-index/routes.md`
- `02-index/symbols.md`
- `02-index/test-map.md`
- 如适用，新增 `jobs.md`、`events.md`

退出条件：
- 关键入口能映射到核心符号或测试
- 后续模块分析不需要重新做全局检索

### 4. 模块分析

目的：按稳定边界沉淀模块知识。

输出：
- `03-modules/<module>.md`
- `08-evidence/<module>.refs.md`
- `09-review/<module>.questions.md`

退出条件：
- 模块职责、边界、依赖、数据读写、风险、测试均已记录
- 关键结论已附证据

### 5. 流程分析

目的：沉淀高价值调用链和业务路径。

输出：
- `04-flows/<flow>.md`
- 必要时补充对应 evidence 文档

退出条件：
- 主路径和失败路径均已记录
- 状态变化和外部调用已标注

### 6. Review Gate

目的：执行一致性和证据校验。

输出：
- `09-review/conflict-log.md`
- `09-review/open-questions.md`
- `09-review/human-review.md`

退出条件：
- 关键冲突已修复或显式挂起
- 证据不足项已列出
- 人工判断项已独立收敛

### 7. Snapshot

目的：为长任务和中断恢复提供状态锚点。

输出：
- `10-snapshots/<timestamp>-<batch>.md`

退出条件：
- 当前完成项、阻塞项、下一步已写明

### 8. 增量更新

目的：根据代码变更增量更新 wiki。

输入：
- `git diff` 或变更文件列表

输出：
- 被影响的模块/流程/evidence 文档更新
- 新增不确定项写入 `09-review/`

退出条件：
- 仅受影响部分被更新
- 陈旧 evidence 已被修正或删除

## 质量门

这是当前最值得补齐的部分。建议新增 4 类 gate。

### Gate A: 产物完整性

用于判断单篇文档是否达到最低可用标准。

模块文档至少满足：
- 目的、边界、依赖、数据读写、风险、测试、证据、开放问题 不为空
- 非 trivial 模块至少有 5 条高价值 evidence

流程文档至少满足：
- 触发条件、入口点、主路径、失败路径、状态变化、外部调用、证据 不为空
- 主路径 必须是顺序步骤，不只是函数列表

### Gate B: 证据充分性

用于判断结论是否真的被源码支撑。

规则：
- 优先引用入口、配置、核心实现、测试
- 尽量使用文件路径加行号范围
- 推断性结论必须标记为 inferred，或进入 开放问题
- 证据 文档中的引用必须能解释“为什么重要”

### Gate C: 跨文档一致性

用于检查模块文档、流程文档、索引文档是否冲突。

重点检查：
- 模块边界是否与 flow 中的职责描述冲突
- test-map 与模块文档中的测试引用是否一致
- symbols/routes 与真实入口是否一致

### Gate D: 增量新鲜度

用于检查文档是否落后于代码。

规则：
- 如某模块最近代码有显著变化，则对应 module doc 必须进入待更新
- 如某关键流程入口变更，则对应 flow doc 必须进入待更新
- 旧 evidence 若不再适配当前代码，不能继续保留为有效证据

## 建议命令层

建议新增一组统一入口。即使先不做成真实命令，也应该先形成稳定约定。

- `/wiki-init`
  - 初始化 phase、queue、glossary、snapshot 基线
- `/wiki-inventory`
  - 产出 inventory 文档
- `/wiki-index`
  - 产出 routes、symbols、test-map 等索引
- `/wiki-module <name>`
  - 分析单个模块并写模块文档、evidence、questions
- `/wiki-flow <name>`
  - 分析单个流程并写 flow 文档
- `/wiki-review`
  - 跑一致性与证据审查
- `/wiki-snapshot`
  - 写当前批次快照
- `/wiki-update-from-diff`
  - 从变更出发更新受影响文档
- `/wiki-status`
  - 汇总当前 phase、队列、覆盖率、阻塞项

## 建议状态模型

建议将当前状态模型从“全局 phase + 简单 queue”升级为“全局阶段 + 任务生命周期”。

### 全局进度

`progress.json` 建议新增字段：
- `current_batch_id`
- `last_snapshot`
- `coverage`
  - `inventory`
  - `index`
  - `modules_total`
  - `modules_done`
  - `flows_total`
  - `flows_done`
- `blockers`
- `last_diff_base`

### 任务状态

建议统一任务状态：
- `pending`
- `scanning`
- `summarizing`
- `evidence-linked`
- `review-needed`
- `done`
- `blocked`

建议每个任务新增字段：
- `owner`
- `priority`
- `depends_on`
- `inputs`
- `outputs`
- `notes`
- `last_updated_at`
- `review_result`

## 建议新增 Meta 文档

建议增加以下文档，补齐“导航层”和“操作层”。

### `00-meta/workflow-contract.md`

定义每个阶段的：
- 输入
- 输出
- gate
- 失败处理
- 下一步

### `00-meta/quality-gates.md`

定义模块文档、流程文档、evidence 文档、review 文档的通过标准。

### `00-meta/status-dashboard.md`

面向阅读者显示：
- 当前覆盖率
- 已完成模块和流程
- 高风险未覆盖区域
- 待人工确认问题

### `00-meta/incremental-update-policy.md`

定义：
- diff 如何映射到模块与流程
- 什么变化必须触发重审
- 什么变化只需微调 evidence

## 建议模板升级

现有模板已经够用，但可以补几个字段来增强可消费性。

### 模块模板

建议新增：
- `上游调用方`
- `下游影响`
- `Configuration 依赖`
- `可观测性`
- `变更风险点`

### 流程模板

建议新增：
- `退出条件`
- `补偿 / 重试`
- `用户可见失败`
- `运行信号`

### 证据模板

建议新增：
- `Claim -> 证据` 对照
- `Contradicting 证据`
- `Confidence`

## 最小实现顺序

建议按最小闭环推进，而不是一次性大改。

### Phase 1

先补“规则层”：
- 新增 `workflow-upgrade.md`
- 新增 `workflow-contract.md`
- 新增 `quality-gates.md`
- 扩展 `progress.json` 和 `task-queue.json` 结构说明

### Phase 2

再补“模板层”：
- 升级 `03-modules/_template.md`
- 升级 `04-flows/_template.md`
- 升级 `08-evidence/_template.md`

### Phase 3

再补“命令层”：
- 在 `00-meta/prompt-templates.md` 中增加 `/wiki-*` 风格任务模板
- 将 `opencode-dispatch-checklist.md` 改写成阶段驱动 runbook

### Phase 4

最后补“质量门与增量维护”：
- 增加 review 清单
- 定义 diff 到 doc 的映射规则
- 引入 coverage 统计视图

## 成功标准

改造完成后，`coder-llm-wiki` 应达到以下标准：

1. 新操作者能从 meta 文档直接知道当前在哪个阶段、下一步做什么。
2. 任意模块或流程文档都能快速找到对应 evidence。
3. review 不再只是补救动作，而是正式 gate。
4. 长时间中断后，可通过 snapshot 和 queue 恢复工作。
5. 面对代码变更时，可以只更新受影响的 wiki 部分。
6. wiki 不只是“文档存放目录”，而是“可持续维护的知识系统”。

## 推荐后续文件

如果继续推进，优先新增或修改这些文件：

1. `coder-llm-wiki/00-meta/workflow-contract.md`
2. `coder-llm-wiki/00-meta/quality-gates.md`
3. `coder-llm-wiki/00-meta/status-dashboard.md`
4. `coder-llm-wiki/00-meta/incremental-update-policy.md`
5. `coder-llm-wiki/03-modules/_template.md`
6. `coder-llm-wiki/04-flows/_template.md`
7. `coder-llm-wiki/08-evidence/_template.md`

## 核心结论

`coder-llm-wiki` 现在的优势是 schema 清晰、证据意识强。

下一步不应该追求像 `get-shit-done` 那样做成重型系统，而应该优先吸收它最有效的三个机制：
- 工作流阶段化
- 质量门前置
- 状态与恢复能力

这样可以在不显著增加复杂度的前提下，把当前 wiki 从“好模板”升级为“好系统”。
