<purpose>
对所有 UAT 和 verification files 做跨 phase audit。找出全部未完成项（pending、skipped、blocked、human_needed），可选地对照代码库验证它们，以识别过期文档，并生成按优先级排序的人工测试计划。
</purpose>

<process>

<step name="initialize">
运行 CLI audit：

```bash
AUDIT=$(gsd-sdk query audit-uat --raw)
```

解析 JSON，提取 `results` 数组和 `summary` 对象。

如果 `summary.total_items` 为 0：
```
## All Clear

No outstanding UAT or verification items found across all phases.
All tests are passing, resolved, or diagnosed with fix plans.
```
到此为止。
</step>

<step name="categorize">
按“现在可执行”与“需要前置条件”分组：

**Testable Now**（无外部依赖）：
- `pending` — tests 从未运行过
- `human_uat` — 需要人工验证的项
- `skipped_unresolved` — 被跳过且没有明确阻塞原因

**Needs Prerequisites：**
- `server_blocked` — 需要外部 server 运行
- `device_needed` — 需要真实设备（不是 simulator）
- `build_needed` — 需要 release/preview build
- `third_party` — 需要外部服务配置

对 “Testable Now” 中的每一项，使用 Grep/Read 检查底层功能在代码库中是否仍存在：
- 如果测试引用的 component/function 已不存在 → 标记为 `stale`
- 如果测试引用的代码已被大幅重写 → 标记为 `needs_update`
- 否则 → 标记为 `active`
</step>

<step name="present">
展示 audit 报告：

```
## UAT Audit Report

**{total_items} outstanding items across {total_files} files in {phase_count} phases**

### Testable Now ({count})

| # | Phase | Test | Description | Status |
|---|-------|------|-------------|--------|
| 1 | {phase} | {test_name} | {expected} | {active/stale/needs_update} |
...

### Needs Prerequisites ({count})

| # | Phase | Test | Blocked By | Description |
|---|-------|------|------------|-------------|
| 1 | {phase} | {test_name} | {category} | {expected} |
...

### Stale (can be closed) ({count})

| # | Phase | Test | Why Stale |
|---|-------|------|-----------|
| 1 | {phase} | {test_name} | {reason} |
...

---

## Recommended Actions

1. **Close stale items:** `/gsd-verify-work {phase}` — mark stale tests as resolved
2. **Run active tests:** Human UAT test plan below
3. **When prerequisites met:** Retest blocked items with `/gsd-verify-work {phase}`
```
</step>

<step name="test_plan">
仅为 “Testable Now” 且状态为 `active` 的项生成人工 UAT test plan：

按可以一起测试的内容分组（同一 screen、同一 feature、同一 prerequisite）：

```
## Human UAT Test Plan

### Group 1: {category — e.g., "Billing Flow"}
Prerequisites: {what needs to be running/configured}

1. **{Test name}** (Phase {N})
   - Navigate to: {where}
   - Do: {action}
   - Expected: {expected behavior}

2. **{Test name}** (Phase {N})
   ...

### Group 2: {category}
...
```
</step>

</process>
