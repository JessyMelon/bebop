# 调试子代理提示模板

用于启动 gsd-debugger agent 的模板。该 agent 已包含全部调试能力，这个模板只提供问题上下文。

---

## 模板

```markdown
<objective>
调查问题：{issue_id}

**摘要：** {issue_summary}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: {true_or_false}
goal: {find_root_cause_only | find_and_fix}
</mode>

<debug_file>
创建：.planning/debug/{slug}.md
</debug_file>
```

---

## 占位符

| 占位符 | 来源 | 示例 |
|-------------|--------|---------|
| `{issue_id}` | 由 orchestrator 分配 | `auth-screen-dark` |
| `{issue_summary}` | 用户描述 | `Auth screen is too dark` |
| `{expected}` | 来自 symptoms | `See logo clearly` |
| `{actual}` | 来自 symptoms | `Screen is dark` |
| `{errors}` | 来自 symptoms | `None in console` |
| `{reproduction}` | 来自 symptoms | `Open /auth page` |
| `{timeline}` | 来自 symptoms | `最近一次部署后` |
| `{goal}` | 由 orchestrator 设置 | `find_and_fix` |
| `{slug}` | 生成得到 | `auth-screen-dark` |

---

## 用法

**来自 /gsd-debug：**
```python
Task(
  prompt=filled_template,
  subagent_type="gsd-debugger",
  description="Debug {slug}"
)
```

**来自 diagnose-issues（UAT）：**
```python
Task(prompt=template, subagent_type="gsd-debugger", description="Debug UAT-001")
```

---

## 继续调试

用于 checkpoint 时，启动一个新的 agent，并使用：

```markdown
<objective>
继续调试 {slug}。证据位于 debug 文件中。
</objective>

<prior_state>
调试文件：@.planning/debug/{slug}.md
</prior_state>

<checkpoint_response>
**类型：** {checkpoint_type}
**回复：** {user_response}
</checkpoint_response>

<mode>
goal: {goal}
</mode>
```
