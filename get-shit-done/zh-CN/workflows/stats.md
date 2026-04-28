<purpose>
显示完整的项目统计信息，包括 phases、plans、requirements、git 指标和时间线。
</purpose>

<required_reading>
开始前读取 invoking prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="gather_stats">
收集项目统计信息：

```bash
STATS=$(gsd-sdk query stats.json)
if [[ "$STATS" == @file:* ]]; then STATS=$(cat "${STATS#@file:}"); fi
```

从 JSON 中提取字段：`milestone_version`, `milestone_name`, `phases`, `phases_completed`, `phases_total`, `total_plans`, `total_summaries`, `percent`, `plan_percent`, `requirements_total`, `requirements_complete`, `git_commits`, `git_first_commit_date`, `last_activity`。
</step>

<step name="present_stats">
按以下格式展示给用户：

```
# 📊 Project Statistics — {milestone_version} {milestone_name}

## Progress
[████████░░] X/Y phases (Z%)

## Plans
X/Y plans complete (Z%)

## Phases
| Phase | Name | Plans | Completed | Status |
|-------|------|-------|-----------|--------|
| ...   | ...  | ...   | ...       | ...    |

## Requirements
✅ X/Y requirements complete

## Git
- **Commits:** N
- **Started:** YYYY-MM-DD
- **Last activity:** YYYY-MM-DD

## Timeline
- **Project age:** N days
```

如果不存在 `.planning/` 目录，提示用户先运行 `/gsd-new-project`。
</step>

</process>

<success_criteria>
- [ ] 已从项目状态收集统计信息
- [ ] 结果格式清晰
- [ ] 已展示给用户
</success_criteria>
