# Debug 模板

用于 `.planning/debug/[slug].md` 的模板，用来跟踪活跃的调试会话。

---

## 文件模板

```markdown
---
status: gathering | investigating | fixing | verifying | awaiting_human_verify | resolved
trigger: "[verbatim user input]"
created: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Focus
<!-- 每次更新都要 OVERWRITE，始终反映 NOW -->

hypothesis: [当前正在验证的理论]
test: [如何验证它]
expecting: [若为真/假，各自意味着什么结果]
next_action: [接下来立刻要做的事，要具体，不要写“continue investigating”]
reasoning_checkpoint: null  <!-- 每次 fix attempt 前都要填充，见 structured_returns -->
tdd_checkpoint: null  <!-- 当 tdd_mode 激活且已确认 root cause 后填充 -->

## Symptoms
<!-- 在 gathering 阶段写入，之后保持 immutable -->

expected: [应该发生什么]
actual: [实际发生了什么]
errors: [如有，填写错误信息]
reproduction: [如何触发]
started: [何时开始出问题 / 一直如此]

## Eliminated
<!-- 只追加 APPEND，防止 /clear 后重新调查 -->

- hypothesis: [被证明错误的理论]
  evidence: [推翻它的证据]
  timestamp: [何时排除]

## Evidence
<!-- 只追加 APPEND，记录调查中发现的事实 -->

- timestamp: [发现时间]
  checked: [检查了什么]
  found: [观察到了什么]
  implication: [这意味着什么]

## Resolution
<!-- 随着理解演进进行 OVERWRITE -->

root_cause: [找到前保持为空]
fix: [应用前保持为空]
verification: [验证前保持为空]
files_changed: []
```

---

<section_rules>

**Frontmatter（status、trigger、timestamps）：**
- `status`: OVERWRITE，反映当前阶段
- `trigger`: IMMUTABLE，保留用户原话，绝不修改
- `created`: IMMUTABLE，只设置一次
- `updated`: OVERWRITE，每次变更都更新

**Current Focus：**
- 每次更新都要整体 OVERWRITE
- 始终反映 Claude RIGHT NOW 正在做什么
- 如果 Claude 在 `/clear` 后读取此文件，也能立刻知道该从哪里继续
- 字段：hypothesis、test、expecting、next_action、reasoning_checkpoint、tdd_checkpoint
- `next_action`: 必须具体且可执行；坏例子：`continue investigating`；好例子：`Add logging at line 47 of auth.js to observe token value before jwt.verify()`
- `reasoning_checkpoint`: 每次 `fix_and_verify` 前 OVERWRITE，记录五字段结构化推理（hypothesis、confirming_evidence、falsification_test、fix_rationale、blind_spots）
- `tdd_checkpoint`: 在 TDD red/green 阶段 OVERWRITE，记录测试文件、名称、状态、失败输出

**Symptoms：**
- 在初始 gathering 阶段写入
- gathering 完成后保持 IMMUTABLE
- 作为我们要修复问题的参照点
- 字段：expected、actual、errors、reproduction、started

**Eliminated：**
- 只追加 APPEND，绝不删除条目
- 防止上下文重置后再次调查死胡同
- 每项包含：hypothesis、推翻它的证据、timestamp
- 对跨 `/clear` 边界的效率非常关键

**Evidence：**
- 只追加 APPEND，绝不删除条目
- 记录调查中发现的事实
- 每项包含：timestamp、检查内容、发现内容、含义
- 为 root cause 建立证据链

**Resolution：**
- 随着理解演进进行 OVERWRITE
- 在尝试修复时可能更新多次
- 最终状态展示已确认的 root cause 和已验证的 fix
- 字段：root_cause、fix、verification、files_changed

</section_rules>

<lifecycle>

**创建：** 在调用 /gsd-debug 时立即创建
- 使用用户输入作为 trigger 创建文件
- 将 status 设为 `gathering`
- Current Focus: `next_action = "gather symptoms"`
- Symptoms: 先留空，待填写

**在收集症状期间：**
- 随用户回答更新 Symptoms section
- 每提一个问题都更新 Current Focus
- 完成后：status → `investigating`

**在调查期间：**
- 每个 hypothesis 都整体 OVERWRITE Current Focus
- 每次发现都向 Evidence APPEND
- hypothesis 被推翻时，向 Eliminated APPEND
- 更新 frontmatter 中的 timestamp

**在修复期间：**
- status → `fixing`
- 确认后更新 `Resolution.root_cause`
- 应用后更新 `Resolution.fix`
- 更新 `Resolution.files_changed`

**在验证期间：**
- status → `verifying`
- 用结果更新 `Resolution.verification`
- 如果验证失败：status → `investigating`，重新尝试

**在自验证通过后：**
- status -> `awaiting_human_verify`
- 在 checkpoint 中请求用户明确确认
- 还不要将文件移动到 resolved

**在问题解决时：**
- status → `resolved`
- 将文件移动到 `.planning/debug/resolved/`（仅在用户确认修复后）

</lifecycle>

<resume_behavior>

当 Claude 在 `/clear` 后读取此文件时：

1. 解析 frontmatter → 知道 status
2. 读取 Current Focus → 知道当时具体在做什么
3. 读取 Eliminated → 知道什么不要重试
4. 读取 Evidence → 知道已经学到了什么
5. 从 `next_action` 继续

这个文件就是调试大脑。Claude 应该能从任何中断点完美恢复。

</resume_behavior>

<size_constraint>

保持 debug 文件聚焦：
- Evidence 条目：每条 1-2 行，只写事实
- Eliminated：简短，写 hypothesis + 失败原因
- 不要叙述性 prose，只保留结构化数据

如果 evidence 变得很大（10+ 条），要考虑是否在原地打转。检查 Eliminated，确保没有重复踩回头路。

</size_constraint>
