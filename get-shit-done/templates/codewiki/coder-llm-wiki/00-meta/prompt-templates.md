# 提示词模板

## 使用说明

这些模板用于驱动 `coder-llm-wiki` 的标准工作流。

使用前应先读取：
- `coder-llm-wiki/00-meta/project-charter.md`
- `coder-llm-wiki/00-meta/workflow-contract.md`
- `coder-llm-wiki/00-meta/quality-gates.md`

所有模板都默认要求：
- 重要结论附 evidence
- 区分事实、推断、问题
- 更新 `progress.json` 和 `task-queue.json`
- 在批次结束时写 snapshot

建议在调用时显式传入执行参数：

- `EXECUTION_MODE=<supervised|deferred-review|unattended>`
- `ASK_FOR_CONFIRMATION=<true|false>`
- `BLOCK_ON_HUMAN_REVIEW=<true|false>`
- `MAX_AUTO_STEPS=<number>`

推荐组合：

- 人工值守：`supervised / true / true`
- 半托管：`deferred-review / false / false`
- 无人值守批处理：`unattended / false / false`

## /wiki-init

```text
目标：初始化或恢复 coder-llm-wiki 的工作上下文。

任务范围：
- 读取 coder-llm-wiki 的 meta 文档
- 检查 progress、queue、snapshot 当前状态
- 设置本轮 batch 的阶段和下一步任务

输入文件：
- coder-llm-wiki/README.md
- coder-llm-wiki/00-meta/project-charter.md
- coder-llm-wiki/00-meta/workflow-contract.md
- coder-llm-wiki/00-meta/quality-gates.md
- coder-llm-wiki/00-meta/progress.json
- coder-llm-wiki/00-meta/task-queue.json
- coder-llm-wiki/00-meta/status-dashboard.md
- coder-llm-wiki/10-snapshots/ 下最新快照（如果存在）

输出文件：
- 更新 coder-llm-wiki/00-meta/progress.json
- 更新 coder-llm-wiki/00-meta/task-queue.json
- 如需要，更新 coder-llm-wiki/00-meta/status-dashboard.md

要求：
1. 明确当前 phase、batch、blockers、next steps。
2. 不要重置已有状态，除非明确是在重新初始化。
3. 如果状态冲突，记录到 09-review/human-review.md。
4. 输出必须能让下一位操作者直接继续工作。
5. 将本次执行参数写入 `coder-llm-wiki/00-meta/progress.json.execution`。
```

## /wiki-inventory

```text
目标：为当前仓库建立初始认知地图，产出 inventory 文档。

任务范围：
- 全仓库
- 重点关注 README、构建配置、部署配置、主入口、顶层目录结构

输出文件：
- coder-llm-wiki/01-inventory/repo-map.md
- coder-llm-wiki/01-inventory/tech-stack.md
- coder-llm-wiki/01-inventory/entrypoints.md
- coder-llm-wiki/01-inventory/module-candidates.json

状态要求：
- 开始前将 progress.phase 设为 inventory
- 完成后更新 coverage.inventory

要求：
1. 不要做空泛总结，尽量依据代码和配置。
2. 明确列出主要应用、服务、包、目录职责。
3. entrypoints 需包含 HTTP、CLI、worker、cron、consumer 等入口。
4. 如果有不确定项，单独标注。
5. 所有关键结论尽量附文件路径。
6. 如果入口识别不完整，明确记录限制原因。
```

## /wiki-index

```text
目标：建立可复用的索引层，减少后续模块和流程分析时的重复扫描。

任务范围：
- 基于真实入口建立 routes 或 commands 索引
- 建立 symbols 索引
- 建立 test map
- 如适用，建立 jobs 或 events 索引

输出文件：
- coder-llm-wiki/02-index/routes.md
- coder-llm-wiki/02-index/symbols.md
- coder-llm-wiki/02-index/test-map.md
- 如有必要，新增 coder-llm-wiki/02-index/jobs.md 或 events.md

状态要求：
- 开始前将 progress.phase 设为 index
- 完成后更新 coverage.index

要求：
1. 索引必须来自真实入口和源码，不要只抄 README。
2. 如果系统高度动态，明确说明哪些索引无法静态解析。
3. 尽量把入口、核心符号和测试建立映射关系。
4. 所有关键项尽量附文件路径。
```

## /wiki-module <MODULE_NAME>

```text
目标：分析模块 <MODULE_NAME>，生成高质量模块文档和证据文档。

任务范围：
- 目录：<PATHS>
- 相关测试目录：<TEST_PATHS>
- 如有必要可查看调用它的入口代码、上游调用方和下游影响

输出文件：
- coder-llm-wiki/03-modules/<MODULE_NAME>.md
- coder-llm-wiki/08-evidence/<MODULE_NAME>.refs.md
- coder-llm-wiki/09-review/<MODULE_NAME>.questions.md

状态要求：
- 将对应任务从 pending -> scanning -> summarizing -> evidence-linked -> review-needed
- 更新 task-queue.json 中的 notes、last_updated_at、review_result

要求：
1. 使用固定模板写模块文档。
2. 区分事实与推断。无法直接从代码验证的内容放到 开放问题 或 风险。
3. 需要引用具体文件和行号作为 evidence。
4. 除模块本身外，必要时查看入口、配置和测试，以补足理解。
5. 重点识别调用方、依赖、数据读写、隐式约束、高风险改动点、配置依赖和 observability。
6. 非 trivial 模块尽量提供至少 5 条高价值 evidence。
```

## /wiki-flow <FLOW_NAME>

```text
目标：分析流程 <FLOW_NAME>，生成流程文档。

任务范围：
- 从这些入口出发：<ENTRY_FILES>
- 允许沿调用链向下追踪
- 允许查看相关模块文档和测试

输出文件：
- coder-llm-wiki/04-flows/<FLOW_NAME>.md
- 如有必要，更新相关 evidence 文档

状态要求：
- 将对应任务从 pending -> scanning -> summarizing -> evidence-linked -> review-needed

要求：
1. 按模板写：触发条件、入口点、前置条件、主路径、退出条件、失败路径、补偿 / 重试、状态变化、外部调用、相关模块、风险、测试、证据、开放问题。
2. 主路径要按顺序描述，不要只列函数名。
3. 明确失败路径、补偿机制、用户可见失败和外部副作用。
4. 标注外部调用、状态变化和操作信号。
5. 用具体文件和行号提供 evidence。
6. 非 trivial flow 尽量提供至少 4 条高价值 evidence。
```

## /wiki-review

```text
目标：对已有 coder-llm-wiki 做一致性和证据校验。

检查范围：
- coder-llm-wiki/03-modules/
- coder-llm-wiki/04-flows/
- coder-llm-wiki/08-evidence/
- coder-llm-wiki/02-index/

输出文件：
- coder-llm-wiki/09-review/conflict-log.md
- coder-llm-wiki/09-review/open-questions.md
- coder-llm-wiki/09-review/human-review.md

要求：
1. 检查模块文档和流程文档是否互相一致。
2. 检查关键结论是否有 evidence 支撑。
3. 检查 evidence 是否足够具体。
4. 检查术语命名是否统一。
5. 检查 facts 和 inference 是否被混写。
6. 将问题分成明确错误、证据不足、推断过强、待人工确认。
7. 按 quality-gates 的口径给出 Pass、Pass With Questions、Fail。
```

## /wiki-snapshot

```text
目标：记录当前批次的可恢复状态。

任务范围：
- 汇总 progress、queue、review、当前 blocker 和 next steps

输出文件：
- coder-llm-wiki/10-snapshots/<TIMESTAMP>-<BATCH>.md
- 更新 coder-llm-wiki/00-meta/progress.json 中的 last_snapshot

要求：
1. 写清当前 phase、batch、已完成项、未完成项、blockers、next steps。
2. 快照应让新的操作者在不追溯完整上下文的情况下继续工作。
3. 如果 queue 与实际产物不一致，先记录不一致再结束。
```

## /wiki-update-from-diff

```text
目标：根据最近变更更新受影响的 coder-llm-wiki 文档。

任务范围：
- 读取当前 git diff 或 changed files
- 找出受影响模块和流程
- 更新对应文档与 evidence

输出：
- 修改已有 coder-llm-wiki 文档
- 在 coder-llm-wiki/09-review/ 中记录新增不确定项
- 如需要，更新 coder-llm-wiki/00-meta/status-dashboard.md
- 如需要，写新的 snapshot

要求：
1. 只更新受影响部分，不要重写整个 wiki。
2. 变更必须反映到模块文档、流程文档或 evidence 文档。
3. 如果现有文档与代码不一致，优先修正文档，并记录冲突来源。
4. 如果无法可靠映射 diff 到文档，先记录 blocker，再补索引或回退到局部重建。
5. 增量更新后至少执行一次轻量 review。
```

## /wiki-status

```text
目标：刷新并输出 coder-llm-wiki 的当前运行状态总览。

任务范围：
- 读取 progress.json
- 读取 task-queue.json
- 读取最新 snapshot
- 读取 09-review/ 下待处理项

输出文件：
- 更新 coder-llm-wiki/00-meta/status-dashboard.md

要求：
1. 汇总当前 phase、batch、coverage、review queue、blockers、high-risk gaps、next steps。
2. 以状态同步为主，不要在 dashboard 中写大量技术细节。
3. dashboard 应帮助读者快速判断下一步，而不是替代所有状态文件。
```

## 共享执行策略块

可附加到任意 `/wiki-*` 模板末尾：

```text
执行参数：
- EXECUTION_MODE=<supervised|deferred-review|unattended>
- ASK_FOR_CONFIRMATION=<true|false>
- BLOCK_ON_HUMAN_REVIEW=<true|false>
- MAX_AUTO_STEPS=<number>

执行策略：
- 将这些参数同步写入 `coder-llm-wiki/00-meta/progress.json.execution`
- 如果 ASK_FOR_CONFIRMATION=false，不要向我请求“下一步动作”
- 如果遇到可延期的人类判断，把问题写入 `coder-llm-wiki/09-review/human-review.md`，并继续当前批次内下一个可执行任务
- 只有在缺少关键输入、权限不足、状态冲突无法自动裁决、或继续执行会导致产物不可靠时，才允许标记为 `blocked`
- 达到 MAX_AUTO_STEPS 或当前批次完成后，更新 `status-dashboard.md` 和 snapshot，再停止
```

## 旧版模板

这些模板保留为兼容性入口，但建议优先使用上面的 `/wiki-*` 形式。

## Inventory 模板
```text
目标：为当前仓库建立初始认知地图，产出 inventory 文档。

任务范围：
- 全仓库
- 重点关注 README、构建配置、部署配置、主入口、顶层目录结构

输出文件：
- coder-llm-wiki/01-inventory/repo-map.md
- coder-llm-wiki/01-inventory/tech-stack.md
- coder-llm-wiki/01-inventory/entrypoints.md
- coder-llm-wiki/01-inventory/module-candidates.json

要求：
1. 不要做空泛总结，尽量依据代码和配置。
2. 明确列出主要应用、服务、包、目录职责。
3. entrypoints 需包含 HTTP、CLI、worker、cron、consumer 等入口。
4. 如果有不确定项，单独标注。
5. 所有关键结论尽量附文件路径。
```

## 模块分析模板
```text
目标：分析模块 <MODULE_NAME>，生成高质量模块文档和证据文档。

任务范围：
- 目录：<PATHS>
- 相关测试目录：<TEST_PATHS>
- 如有必要可查看调用它的入口代码和上游调用方

输出文件：
- coder-llm-wiki/03-modules/<MODULE_NAME>.md
- coder-llm-wiki/08-evidence/<MODULE_NAME>.refs.md
- coder-llm-wiki/09-review/<MODULE_NAME>.questions.md

要求：
1. 使用固定模板写模块文档。
2. 区分事实与推断。无法直接从代码验证的内容放到 开放问题 或 风险。
3. 需要引用具体文件和行号作为 evidence。
4. 除模块本身外，必要时查看入口、配置和测试，以补足理解。
5. 重点识别调用方、依赖、数据读写、隐式约束和高风险改动点。
```

## 流程分析模板
```text
目标：分析流程 <FLOW_NAME>，生成流程文档。

任务范围：
- 从这些入口出发：<ENTRY_FILES>
- 允许沿调用链向下追踪
- 允许查看相关模块文档和测试

输出文件：
- coder-llm-wiki/04-flows/<FLOW_NAME>.md

要求：
1. 按模板写：触发条件、入口点、前置条件、主路径、失败路径、状态变化、外部调用、相关模块、风险、测试、证据、开放问题。
2. 主路径要按顺序描述，不要只列函数名。
3. 明确失败路径和补偿机制。
4. 标注外部调用和副作用。
5. 用具体文件和行号提供 evidence。
```

## Review 模板
```text
目标：对已有 coder llm wiki 做一致性和证据校验。

检查范围：
- coder-llm-wiki/03-modules/
- coder-llm-wiki/04-flows/
- coder-llm-wiki/08-evidence/

输出文件：
- coder-llm-wiki/09-review/conflict-log.md
- coder-llm-wiki/09-review/open-questions.md
- coder-llm-wiki/09-review/human-review.md

要求：
1. 检查模块文档和流程文档是否互相一致。
2. 检查关键结论是否有 evidence 支撑。
3. 检查 evidence 是否足够具体。
4. 检查术语命名是否统一。
5. 将问题分成明确错误、证据不足、推断过强、待人工确认。
```

## 增量更新模板
```text
目标：根据最近变更更新受影响的 coder llm wiki 文档。

任务范围：
- 读取当前 git diff
- 找出受影响模块和流程
- 更新对应文档与证据

输出：
- 修改已有 coder-llm-wiki 文档
- 在 coder-llm-wiki/09-review/ 中记录新增不确定项

要求：
1. 只更新受影响部分，不要重写整个 wiki。
2. 变更必须反映到模块文档、流程文档或 evidence 文档。
3. 如果现有文档与代码不一致，优先修正文档，并记录冲突来源。
```
