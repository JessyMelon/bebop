# 规划子代理提示模板

用于生成 gsd-planner 代理的模板。该代理包含全部规划专业能力 - 此模板只提供规划上下文。

---

## 模板

```markdown
<planning_context>

**阶段：** {phase_number}
**模式：** {standard | gap_closure}

**项目状态：**
@.planning/STATE.md

**路线图：**
@.planning/ROADMAP.md

**需求（如果存在）：**
@.planning/REQUIREMENTS.md

**阶段上下文（如果存在）：**
@.planning/phases/{phase_dir}/{phase_num}-CONTEXT.md

**研究（如果存在）：**
@.planning/phases/{phase_dir}/{phase_num}-RESEARCH.md

**Gap Closure（如果是 --gaps 模式）：**
@.planning/phases/{phase_dir}/{phase_num}-VERIFICATION.md
@.planning/phases/{phase_dir}/{phase_num}-UAT.md

</planning_context>

<downstream_consumer>
输出由 /gsd-execute-phase 消费
计划必须是可执行提示，并包含：
- Frontmatter（wave、depends_on、files_modified、autonomous）
- XML 格式的任务
- 验证标准
- 用于目标逆推验证的 must_haves
</downstream_consumer>

<quality_gate>
在返回 PLANNING COMPLETE 之前：
- [ ] 已在阶段目录中创建 PLAN.md 文件
- [ ] 每个计划都有合法的 frontmatter
- [ ] 任务具体且可执行
- [ ] 依赖识别正确
- [ ] 已为并行执行分配波次
- [ ] 已从阶段目标推导 must_haves
</quality_gate>
```

---

## 占位符

| Placeholder | 来源 | 示例 |
|-------------|--------|---------|
| `{phase_number}` | 来自 roadmap/参数 | `5` 或 `2.1` |
| `{phase_dir}` | 阶段目录名 | `05-user-profiles` |
| `{phase}` | 阶段前缀 | `05` |
| `{standard \| gap_closure}` | 模式标志 | `standard` |

---

## 用法

**来自 /gsd-plan-phase（标准模式）：**
```python
Task(
  prompt=filled_template,
  subagent_type="gsd-planner",
  description="规划阶段 {phase}"
)
```

**来自 /gsd-plan-phase --gaps（gap closure 模式）：**
```python
Task(
  prompt=filled_template,  # mode: gap_closure
  subagent_type="gsd-planner",
  description="为阶段 {phase} 规划缺口"
)
```

---

## 延续

对于检查点，使用以下内容启动一个新的代理：

```markdown
<objective>
继续为阶段 {phase_number}: {phase_name} 制定计划
</objective>

<prior_state>
阶段目录：@.planning/phases/{phase_dir}/
现有计划：@.planning/phases/{phase_dir}/*-PLAN.md
</prior_state>

<checkpoint_response>
**类型：** {checkpoint_type}
**响应：** {user_response}
</checkpoint_response>

<mode>
继续：{standard | gap_closure}
</mode>
```

---

**注意：** 规划方法、任务拆分、依赖分析、波次分配、TDD 检测以及目标逆推推导都内置于 gsd-planner 代理中。此模板只负责传递上下文。
