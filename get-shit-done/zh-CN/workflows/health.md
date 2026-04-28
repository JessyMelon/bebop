<purpose>
验证 `.planning/` 目录完整性，并报告可执行的问题。检查缺失文件、无效配置、不一致状态以及孤立计划。可选择修复可自动修复的问题。
</purpose>

<required_reading>
开始前先读取调用提示的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="parse_args">
**解析参数：**

检查命令参数中是否存在 `--repair` 或 `--backfill` flags。

```
REPAIR_FLAG=""
BACKFILL_FLAG=""
if arguments contain "--repair"; then
  REPAIR_FLAG="--repair"
fi
if arguments contain "--backfill"; then
  BACKFILL_FLAG="--backfill"
fi
```
</step>

<step name="run_health_check">
**运行健康检查：**

```bash
gsd-sdk query validate.health $REPAIR_FLAG $BACKFILL_FLAG
```

解析 JSON 输出：
- `status`："healthy" | "degraded" | "broken"
- `errors[]`：关键问题（code、message、fix、repairable）
- `warnings[]`：非关键问题
- `info[]`：信息性说明
- `repairable_count`：可自动修复问题的数量
- `repairs_performed[]`：使用 --repair 时执行的操作
</step>

<step name="format_output">
**格式化并显示结果：**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: HEALTHY | DEGRADED | BROKEN
Errors: N | Warnings: N | Info: N
```

**如果执行了修复：**
```
## Repairs Performed

- ✓ config.json: Created with defaults
- ✓ STATE.md: Regenerated from roadmap
```

**如果存在 errors：**
```
## Errors

- [E001] config.json: JSON parse error at line 5
  Fix: Run /gsd-health --repair to reset to defaults

- [E002] PROJECT.md not found
  Fix: Run /gsd-new-project to create
```

**如果存在 warnings：**
```
## Warnings

- [W002] STATE.md references phase 5, but only phases 1-3 exist
  Fix: Review STATE.md manually before changing it; repair will not overwrite an existing STATE.md

- [W005] Phase directory "1-setup" doesn't follow NN-name format
  Fix: Rename to match pattern (e.g., 01-setup)
```

**如果存在 info：**
```
## Info

- [I001] 02-implementation/02-01-PLAN.md has no SUMMARY.md
  Note: May be in progress
```

**页脚（如果存在可修复问题且未使用 --repair）：**
```
---
N issues can be auto-repaired. Run: /gsd-health --repair
```
</step>

<step name="offer_repair">
**如果存在可修复问题且未使用 --repair：**

询问用户是否要运行修复：

```
Would you like to run /gsd-health --repair to fix N issues automatically?
```

如果是，则带 `--repair` flag 重新运行并显示结果。
</step>

<step name="verify_repairs">
**如果执行了修复：**

不带 `--repair` 重新运行健康检查，以确认问题已解决：

```bash
gsd-sdk query validate.health
```

报告最终状态。
</step>

</process>

<error_codes>

| Code | Severity | Description | Repairable |
|------|----------|-------------|------------|
| E001 | error | .planning/ directory not found | No |
| E002 | error | PROJECT.md not found | No |
| E003 | error | ROADMAP.md not found | No |
| E004 | error | STATE.md not found | Yes |
| E005 | error | config.json parse error | Yes |
| W001 | warning | PROJECT.md missing required section | No |
| W002 | warning | STATE.md references invalid phase | No |
| W003 | warning | config.json not found | Yes |
| W004 | warning | config.json invalid field value | No |
| W005 | warning | Phase directory naming mismatch | No |
| W006 | warning | Phase in ROADMAP but no directory | No |
| W007 | warning | Phase on disk but not in ROADMAP | No |
| W008 | warning | config.json: workflow.nyquist_validation absent (defaults to enabled but agents may skip) | Yes |
| W009 | warning | Phase has Validation Architecture in RESEARCH.md but no VALIDATION.md | No |
| W018 | warning | MILESTONES.md missing entry for archived milestone snapshot | Yes (`--backfill`) |
| W019 | warning | Unrecognized .planning/ root file — not a canonical GSD artifact | No |
| I001 | info | Plan without SUMMARY (may be in progress) | No |

</error_codes>

<repair_actions>

| Action | Effect | Risk |
|--------|--------|------|
| createConfig | Create config.json with defaults | None |
| resetConfig | Delete + recreate config.json | Loses custom settings |
| regenerateState | Create STATE.md from ROADMAP structure when it is missing | Loses session history |
| addNyquistKey | Add workflow.nyquist_validation: true to config.json | None — matches existing default |
| backfillMilestones | Synthesize missing MILESTONES.md entries from `.planning/milestones/vX.Y-ROADMAP.md` snapshots | None — additive only; triggered by `--backfill` flag |

**不可修复（风险过高）：**
- PROJECT.md、ROADMAP.md 内容
- Phase 目录重命名
- 孤立计划清理

</repair_actions>

<stale_task_cleanup>
**仅限 Windows：** 检查因崩溃/冻结而累积的过期 Claude Code 任务目录。
这些目录会在子代理被强制终止后遗留，并占用磁盘空间。

当启用 `--repair` 时，检测并清理：

```bash
# Check for stale task directories (older than 24 hours)
TASKS_DIR="$HOME/.claude/tasks"
if [ -d "$TASKS_DIR" ]; then
  STALE_COUNT=$( (find "$TASKS_DIR" -maxdepth 1 -type d -mtime +1 2>/dev/null || true) | wc -l )
  if [ "$STALE_COUNT" -gt 0 ]; then
    echo "⚠️  Found $STALE_COUNT stale task directories in ~/.claude/tasks/"
    echo "   These are leftover from crashed subagent sessions."
    echo "   Run: rm -rf ~/.claude/tasks/*  (safe — only affects dead sessions)"
  fi
fi
```

作为信息诊断报告：`I002 | info | Stale subagent task directories found | Yes (--repair removes them)`
</stale_task_cleanup>
