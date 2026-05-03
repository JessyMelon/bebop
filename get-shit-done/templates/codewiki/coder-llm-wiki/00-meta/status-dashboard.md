# 状态面板

## 目的

本文件提供 `coder-llm-wiki` 的运行态总览，方便操作者和阅读者快速回答以下问题：
- 当前处于哪个阶段
- 已覆盖哪些模块和流程
- 还有哪些高风险空白
- 哪些问题需要人工确认
- 下一步最应该做什么

本文件应作为人工查看面板使用。
具体状态仍以 `progress.json` 和 `task-queue.json` 为准。

## 建议更新时间

建议在以下时机更新本文件：
- 完成 inventory 后
- 完成 index 后
- 每完成一批模块分析后
- 每完成一批 flow 分析后
- 每次 cross review 后
- 每次 incremental update 后

## 面板模板

以下结构可直接作为实际内容模板使用。

### 当前运行

- 当前 phase：
- 当前 batch id：
- 执行模式：
- 是否请求确认：
- 是否阻塞于人工 review：
- 最大自动步数：
- 最后更新：
- 最新 snapshot：
- Diff base：

### 覆盖摘要

- Inventory：`0% / 100%`
- Index：`0% / 100%`
- Modules：`0 / 0 done`
- Flows：`0 / 0 done`

### 当前优先级

1. 
2. 
3. 

### 当前阻塞

- 无

or

- `<blocker>`
  - 影响：
  - 需要动作：

### 最近完成

- `<task-id>` - 完成了什么
- `<task-id>` - 完成了什么

### Review 模板 队列

- `review-needed`: 
- `blocked`: 
- `out-of-scope`:
- `pending high-priority`: 

### 高风险缺口

- `<area>` - 为什么重要
- `<flow or module>` - 为什么重要

### 需要人工 Review

- `<question>`
- `<conflict>`

### 建议下一步

1. 
2. 
3. 

## 推荐阅读顺序

当读者第一次进入 wiki 时，建议按以下顺序看：

1. `README.md`
2. `00-meta/project-charter.md`
3. `00-meta/status-dashboard.md`
4. `01-inventory/`
5. `02-index/`
6. `03-modules/` 和 `04-flows/`
7. `09-review/`

## 建议填充规则

### 当前运行

从 `progress.json` 同步：
- `phase`
- `current_batch_id`
- `execution.mode`
- `execution.ask_for_confirmation`
- `execution.block_on_human_review`
- `execution.max_auto_steps`
- `updated_at`
- `last_snapshot`
- `last_diff_base`

### 覆盖摘要

从 `progress.json.coverage` 同步：
- inventory
- index
- modules_total
- modules_done
- flows_total
- flows_done

### Review 模板 队列

从 `task-queue.json` 汇总：
- `review-needed` 数量
- `blocked` 数量
- `out-of-scope` 数量
- 高优先级 `pending` 数量

### 当前阻塞

优先从以下位置汇总：
- `progress.json.blockers`
- `09-review/open-questions.md`
- `09-review/human-review.md`

### 高风险缺口

优先标出：
- 没有模块文档的核心模块
- 没有流程文档的关键入口
- 动态路由、异步任务、外部依赖、数据一致性相关区域

## 建议状态含义

### 健康

满足以下特征：
- 当前 phase 明确
- queue 中没有失控积压
- review-needed 数量可控
- blocker 已被记录
- 最近 snapshot 存在

### 有风险

满足任一特征：
- queue 长时间未更新
- review-needed 积压过多
- 高风险模块长期未覆盖
- snapshot 长时间缺失
- blockers 存在但没有后续动作

### 已过期

满足任一特征：
- 代码已经显著变更但 wiki 未更新
- evidence 引用落后于当前实现
- dashboard 与 `progress.json` 明显不一致

## 轻量维护流程

每次更新 dashboard 时，按以下顺序做：

1. 读取 `progress.json`
2. 读取 `task-queue.json`
3. 读取最新 snapshot
4. 检查 `09-review/` 下未解决项
5. 更新本文件的当前运行、覆盖率、阻塞和下一步

## 不要这样做

- 不要把 dashboard 写成历史流水账
- 不要复制所有 queue 细节到这里
- 不要在这里放未经证据支持的技术结论

## 核心结论

`status-dashboard.md` 的职责不是替代状态文件，而是让人快速知道：现在系统处于什么状态，问题在哪，接下来做什么。
