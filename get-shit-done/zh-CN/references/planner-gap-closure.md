# Gap Closure Mode — Planner Reference

由 `--gaps` flag 触发。用于创建 plans，解决 verification 或 UAT 失败。

**Important: Skip deferred items.** 读取 VERIFICATION.md 时，只有 `gaps:` section 中的项才是需要 closure plans 的可执行项。`deferred:` section（如果存在）列的是已明确安排到后续 milestone phases 中处理的事项 —— 这些**不是** gaps，必须在 gap closure planning 时忽略。为 deferred items 再创建 plans，只会把已经排期好的未来工作重复做一遍。

**1. Find gap sources:**

使用 init context（来自 load_project_state），其中会提供 `phase_dir`：

```bash
# Check for VERIFICATION.md (code verification gaps)
ls "$phase_dir"/*-VERIFICATION.md 2>/dev/null

# Check for UAT.md with diagnosed status (user testing gaps)
grep -l "status: diagnosed" "$phase_dir"/*-UAT.md 2>/dev/null
```

**2. Parse gaps:** 每个 gap 包含：truth（失败的行为）、reason、artifacts（有问题的文件）、missing（需要补上/修复的内容）。

**3. Load existing SUMMARYs**，以理解已经实现了什么。

**4. Find next plan number:** 如果已有 01-03，则下一个是 04。

**5. Group gaps into plans**，依据：相同 artifact、相同 concern、依赖顺序（如果 artifact 还是 stub，就不能先接线 —— 应先修 stub）。

**6. Create gap closure tasks:**

```xml
<task name="{fix_description}" type="auto">
  <files>{artifact.path}</files>
  <action>
    {For each item in gap.missing:}
    - {missing item}

    Reference existing code: {from SUMMARYs}
    Gap reason: {gap.reason}
  </action>
  <verify>{How to confirm gap is closed}</verify>
  <done>{Observable truth now achievable}</done>
</task>
```

**7. Assign waves using standard dependency analysis**（与 `assign_waves` step 相同）：
- 没有依赖的 plans → wave 1
- 依赖其他 gap closure plans 的 plans → `max(dependency waves) + 1`
- 同时还要考虑对该 phase 内已有（非 gap）plans 的依赖

**8. Write PLAN.md files:**

```yaml
---
phase: XX-name
plan: NN              # Sequential after existing
type: execute
wave: N               # Computed from depends_on (see assign_waves)
depends_on: [...]     # Other plans this depends on (gap or existing)
files_modified: [...]
autonomous: true
gap_closure: true     # Flag for tracking
---
```
