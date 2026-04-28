<purpose>
自动修复 `REVIEW.md` 中的问题。校验 phase，检查 config gate，确认 `REVIEW.md` 存在且包含可修复问题，启动 `gsd-code-fixer` agent，处理 `--auto` 迭代循环（上限 3 次），仅在最后一次性提交 `REVIEW-FIX.md`，并展示结果。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<available_agent_types>
- gsd-code-fixer: 应用 code review findings 的修复
- gsd-code-reviewer: 审查源文件中的 bug 和问题
</available_agent_types>

<process>

<step name="initialize">
解析参数并加载项目状态：

```bash
PHASE_ARG="${1}"
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中解析：`phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`, `commit_docs`。

**Input sanitization (defense-in-depth):**
```bash
# Validate PADDED_PHASE contains only digits and optional dot (e.g., "02", "03.1")
if ! [[ "$PADDED_PHASE" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Error: Invalid phase number format: '${PADDED_PHASE}'. Expected digits (e.g., 02, 03.1)."
  # Exit workflow
fi
```

**Phase validation (before config gate):**
如果 `phase_found` 为 false，报告错误并退出：
```
Error: Phase ${PHASE_ARG} not found. Run /gsd-status to see available phases.
```

这一步在 config gate 检查之前执行，因此无论 config 状态如何，都能立即暴露用户输入错误。

从 $ARGUMENTS 中解析可选 flag：

```bash
FIX_ALL=false
AUTO_MODE=false
for arg in "$@"; do
  if [[ "$arg" == "--all" ]]; then FIX_ALL=true; fi
  if [[ "$arg" == "--auto" ]]; then AUTO_MODE=true; fi
done
```

计算 scope 变量：

```bash
if [ "$FIX_ALL" = "true" ]; then
  FIX_SCOPE="all"
else
  FIX_SCOPE="critical_warning"
fi
```

计算 review 与 fix report 路径：

```bash
REVIEW_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW.md"
FIX_REPORT_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW-FIX.md"
```
</step>

<step name="check_config_gate">
检查是否通过 config 启用了 code review：

```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```

如果 CODE_REVIEW_ENABLED 为 "false"：
```
Code review fix skipped (workflow.code_review=false in config)
```
退出 workflow。

默认值为 true，只有显式为 false 时才跳过。此检查在 phase validation 之后执行，因此无效 phase 的错误会优先显示。

注意：这里复用了 `workflow.code_review` 配置键，而没有额外引入 `workflow.code_review_fix`。理由：没有 review 时修复没有意义，因此共用一个开关是合理的。如果后续需要独立控制，可以在 v2 中添加单独的键。
</step>

<step name="check_review_exists">
验证 `REVIEW.md` 是否存在：

```bash
if [ ! -f "${REVIEW_PATH}" ]; then
  echo "Error: No REVIEW.md found for Phase ${PHASE_ARG}. Run /gsd-code-review ${PHASE_ARG} first."
  exit 1
fi
```

不要自动运行 `code-review`。要求用户显式执行，以确保 review 意图清晰。
</step>

<step name="check_review_status">
解析 `REVIEW.md` frontmatter，检查状态并提取 `--auto` 循环所需上下文：

```bash
# Parse status field
REVIEW_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match && /status:\s*(\S+)/.test(match[1])) {
    console.log(match[1].match(/status:\s*(\S+)/)[1]);
  } else {
    console.log('unknown');
  }
" 2>/dev/null)
```

如果状态为 `"clean"` 或 `"skipped"`：
```
No issues to fix in Phase ${PHASE_ARG} REVIEW.md (status: ${REVIEW_STATUS}).
```
退出 workflow。

如果状态为 `"unknown"`：
```
Warning: Could not parse REVIEW.md status. Proceeding with fix attempt.
```

提取 `--auto` 重新 review 所需的 review depth：

```bash
REVIEW_DEPTH=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match && /depth:\s*(\S+)/.test(match[1])) {
    console.log(match[1].match(/depth:\s*(\S+)/)[1]);
  } else {
    console.log('standard');
  }
" 2>/dev/null)
```

提取原始 review 的文件列表，以便在 `--auto` 重新 review 时保持范围一致：

```bash
# Extract review file list — portable bash 3.2+ (no mapfile, handles spaces in paths)
REVIEW_FILES_ARRAY=()
while IFS= read -r line; do
  [ -n "$line" ] && REVIEW_FILES_ARRAY+=("$line")
done < <(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const fm = match[1];
    // Try YAML array format: files_reviewed_list: [file1, file2]
    const bracketMatch = fm.match(/files_reviewed_list:\s*\[([^\]]+)\]/);
    if (bracketMatch) {
      bracketMatch[1].split(',').map(f => f.trim()).filter(Boolean).forEach(f => console.log(f));
    } else {
      // Try YAML list format: files_reviewed_list:\n  - file1\n  - file2
      let inList = false;
      for (const line of fm.split('\n')) {
        if (/files_reviewed_list:/.test(line)) { inList = true; continue; }
        if (inList && /^\s+-\s+(.+)/.test(line)) { console.log(line.match(/^\s+-\s+(.+)/)[1].trim()); }
        else if (inList && /^\S/.test(line)) { break; }
      }
    }
  }
" 2>/dev/null)
```

如果 `REVIEW.md` 的 frontmatter 中包含 `files_reviewed_list` 字段，则将其作为重新 review 的范围。如果不存在，则回退为重新审查整个 phase（与初次 `code-review` 行为一致）。
</step>

<step name="spawn_fixer">
使用以下配置启动 `gsd-code-fixer` agent：

```bash
# Build config for agent
echo "Applying fixes from ${REVIEW_PATH}..."
echo "Fix scope: ${FIX_SCOPE}"
```

使用 `Task()` 启动 agent：

```
Task(subagent_type="gsd-code-fixer", prompt="
<files_to_read>
${REVIEW_PATH}
</files_to_read>

<config>
phase_dir: ${PHASE_DIR}
padded_phase: ${PADDED_PHASE}
review_path: ${REVIEW_PATH}
fix_scope: ${FIX_SCOPE}
fix_report_path: ${FIX_REPORT_PATH}
iteration: 1
</config>

Read REVIEW.md findings, apply fixes, commit each atomically, write REVIEW-FIX.md. Do NOT commit REVIEW-FIX.md (orchestrator handles that).
")
```

**Agent failure handling:**

如果 `Task()` 失败：
```
Error: Code fix agent failed: ${error_message}
```

检查 `FIX_REPORT_PATH` 是否存在：
- 如果存在：`"Partial success — some fixes may have been committed."`
- 如果不存在：`"No fixes applied."`

无论哪种情况：
```
Some fix commits may already exist in git history — check git log for fix(${PADDED_PHASE}) commits.
You can retry with /gsd-code-review-fix ${PHASE_ARG}.
```

退出 workflow（跳过 auto loop）。
</step>

<step name="auto_iteration_loop">
仅当 `AUTO_MODE` 为 true 时运行。如果 `AUTO_MODE` 为 false，则完全跳过此步骤。

```bash
if [ "$AUTO_MODE" = "true" ]; then
  # Iteration semantics: the initial fix pass (step 5) is iteration 1.
  # This loop runs iterations 2..MAX_ITERATIONS (re-review + re-fix cycles).
  # Total fix passes = MAX_ITERATIONS. Loop uses -lt (not -le) intentionally.
  ITERATION=1
  MAX_ITERATIONS=3
  
  while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  --auto: Starting iteration ${ITERATION}/${MAX_ITERATIONS}"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    # Re-review using same depth and file scope as original review
    echo "Re-reviewing phase ${PHASE_ARG} at ${REVIEW_DEPTH} depth..."
    
    # Backup previous REVIEW.md and REVIEW-FIX.md before overwriting
    if [ -f "${REVIEW_PATH}" ]; then
      cp "${REVIEW_PATH}" "${REVIEW_PATH%.md}.iter${ITERATION}.md" 2>/dev/null || true
    fi
    if [ -f "${FIX_REPORT_PATH}" ]; then
      cp "${FIX_REPORT_PATH}" "${FIX_REPORT_PATH%.md}.iter${ITERATION}.md" 2>/dev/null || true
    fi
    
    # If original review had explicit file list, pass it safely to re-review agent
    FILES_CONFIG=""
    if [ ${#REVIEW_FILES_ARRAY[@]} -gt 0 ]; then
      FILES_CONFIG="files:"
      for f in "${REVIEW_FILES_ARRAY[@]}"; do
        FILES_CONFIG="${FILES_CONFIG}
  - ${f}"
      done
    fi
    
    # Spawn gsd-code-reviewer agent to re-review
    # (This overwrites REVIEW_PATH with latest review state)
    Task(subagent_type="gsd-code-reviewer", prompt="
<config>
depth: ${REVIEW_DEPTH}
phase_dir: ${PHASE_DIR}
review_path: ${REVIEW_PATH}
${FILES_CONFIG}
</config>

Re-review the phase at ${REVIEW_DEPTH} depth. Write findings to ${REVIEW_PATH}.
Do NOT commit the output — the orchestrator handles that.
")
    
    # Check new REVIEW.md status
    NEW_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
      const fs = require('fs');
      const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match && /status:\s*(\S+)/.test(match[1])) {
        console.log(match[1].match(/status:\s*(\S+)/)[1]);
      } else {
        console.log('unknown');
      }
    " 2>/dev/null)
    
    if [ "$NEW_STATUS" = "clean" ]; then
      echo ""
      echo "✓ All issues resolved after iteration ${ITERATION}."
      break
    fi
    
    # Still has issues — spawn fixer again
    echo "Issues remain. Applying fixes for iteration ${ITERATION}..."
    
    Task(subagent_type="gsd-code-fixer", prompt="
<files_to_read>
${REVIEW_PATH}
</files_to_read>

<config>
phase_dir: ${PHASE_DIR}
padded_phase: ${PADDED_PHASE}
review_path: ${REVIEW_PATH}
fix_scope: ${FIX_SCOPE}
fix_report_path: ${FIX_REPORT_PATH}
iteration: ${ITERATION}
</config>

Read REVIEW.md findings, apply fixes, commit each atomically, write REVIEW-FIX.md (overwrite previous). Do NOT commit REVIEW-FIX.md.
")
    
    # Check if fixer succeeded
    if [ ! -f "${FIX_REPORT_PATH}" ]; then
      echo "Warning: Iteration ${ITERATION} fixer failed to produce fix report. Stopping auto-loop."
      break
    fi
  done
  
  # After loop completes
  if [ $ITERATION -ge $MAX_ITERATIONS ]; then
    echo ""
    echo "⚠ Reached maximum iterations (${MAX_ITERATIONS}). Remaining issues documented in REVIEW-FIX.md."
  fi
fi
```

`--auto` 的关键设计决策（覆盖 review 中的全部 HIGH concern）：
1. **Re-review scope:** 使用原始 `REVIEW.md` frontmatter 中的 `REVIEW_FILES_ARRAY`，若没有则回退为整个 phase 范围。迭代间不会丢失范围。使用可移植的 while-read 循环（兼容 bash 3.2+，可处理带空格的路径）。
2. **Artifact semantics:** 每次重新 review 都会覆盖 `REVIEW.md`（始终表示最新 review 状态）。每次 fixer 迭代都会覆盖 `REVIEW-FIX.md`（始终表示最新修复状态并带迭代计数）。每个产物都只有一个最终版本，而不是每轮一个副本。
   备份文件（`.iterN.md`）用于在迭代退化时保留历史，便于事后分析。
3. **Commit timing:** fix commit 在 agent 内按 finding 逐条进行。`REVIEW-FIX.md` 直到 Step 7（全部迭代完成后）才提交。只会为 `REVIEW-FIX.md` 生成 **一个** docs commit，而不是每轮一次。
</step>

<step name="commit_fix_report">
在全部迭代完成之后（或非 auto 模式下仅完成单轮后），验证并提交 `REVIEW-FIX.md`：

```bash
if [ -f "${FIX_REPORT_PATH}" ]; then
  # Validate REVIEW-FIX.md has valid YAML frontmatter with status field
  HAS_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
    const fs = require('fs');
    const content = fs.readFileSync(process.env.FIX_REPORT_PATH, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match && /status:/.test(match[1])) { console.log('valid'); } else { console.log('invalid'); }
  " 2>/dev/null)
  
  if [ "$HAS_STATUS" = "valid" ]; then
    echo "REVIEW-FIX.md created at ${FIX_REPORT_PATH}"
    
    if [ "$COMMIT_DOCS" = "true" ]; then
      gsd-sdk query commit \
        "docs(${PADDED_PHASE}): add code review fix report" \
        --files "${FIX_REPORT_PATH}"
    fi
  else
    echo "Warning: REVIEW-FIX.md has invalid frontmatter (no status field). Not committing."
    echo "Agent may have produced malformed output. Review manually: ${FIX_REPORT_PATH}"
  fi
else
  echo "Warning: REVIEW-FIX.md not found at ${FIX_REPORT_PATH}."
  echo "Agent may have failed before writing report."
  echo "Check git log for any fix(${PADDED_PHASE}) commits that were applied."
fi
```

此提交只会在 workflow 结束时发生 **一次**，即所有迭代（若启用 `--auto`）全部完成之后，而不是每轮一次。
</step>

<step name="present_results">
解析 `REVIEW-FIX.md` frontmatter，并向用户展示格式化摘要。

首先检查 fix report 是否存在：

```bash
if [ ! -f "${FIX_REPORT_PATH}" ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "  ⚠ No fix report generated"
  echo ""
  echo "───────────────────────────────────────────────────────────────"
  echo ""
  echo "The fixer agent may have failed before completing."
  echo "Check git log for any fix(${PADDED_PHASE}) commits."
  echo ""
  echo "Retry: /gsd-code-review-fix ${PHASE_ARG}"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi
```

提取 frontmatter 字段：

```bash
# Extract only the YAML frontmatter block (between first two --- lines)
FIX_FRONTMATTER=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.FIX_REPORT_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) process.stdout.write(match[1]);
" 2>/dev/null)

# Parse fields from frontmatter only (not full file)
FIX_STATUS=$(echo "$FIX_FRONTMATTER" | grep "^status:" | cut -d: -f2 | xargs)
FINDINGS_IN_SCOPE=$(echo "$FIX_FRONTMATTER" | grep "^findings_in_scope:" | cut -d: -f2 | xargs)
FIXED_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^fixed:" | cut -d: -f2 | xargs)
SKIPPED_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^skipped:" | cut -d: -f2 | xargs)
ITERATION_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^iteration:" | cut -d: -f2 | xargs)
```

显示格式化的 inline 摘要：

```bash
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Code Review Fix Complete: Phase ${PHASE_NUMBER} (${PHASE_NAME})"
echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "  Fix Scope:       ${FIX_SCOPE}"
echo "  Findings:        ${FINDINGS_IN_SCOPE}"
echo "  Fixed:           ${FIXED_COUNT}"
echo "  Skipped:         ${SKIPPED_COUNT}"
if [ "$AUTO_MODE" = "true" ]; then
  echo "  Iterations:      ${ITERATION_COUNT}"
fi
echo "  Status:          ${FIX_STATUS}"
echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
```

如果 status 为 `"all_fixed"`：
```bash
if [ "$FIX_STATUS" = "all_fixed" ]; then
  echo "✓ All issues resolved."
  echo ""
  echo "Full report: ${FIX_REPORT_PATH}"
  echo ""
  echo "Next step:"
  echo "  /gsd-verify-work  — Verify phase completion"
  echo ""
fi
```

如果 status 为 `"partial"` 或 `"none_fixed"`：
```bash
if [ "$FIX_STATUS" = "partial" ] || [ "$FIX_STATUS" = "none_fixed" ]; then
  echo "⚠ Some issues could not be fixed automatically."
  echo ""
  echo "Full report: ${FIX_REPORT_PATH}"
  echo ""
  echo "Next steps:"
  echo "  cat ${FIX_REPORT_PATH}                     — View fix report"
  echo "  /gsd-code-review ${PHASE_NUMBER}           — Re-review code"
  echo "  /gsd-verify-work                           — Verify phase completion"
  echo ""
fi
```

```bash
echo "═══════════════════════════════════════════════════════════════"
```
</step>

</process>

<platform_notes>
**Windows:** 此 workflow 使用 bash 特性（数组、变量展开、while 循环）。在 Windows 上需要 Git Bash 或 WSL。不支持原生 PowerShell。CI matrix（Ubuntu/macOS/Windows）在 Windows runner 上通过 Git Bash 运行，因此具备 bash 兼容性。
</platform_notes>

<success_criteria>
- [ ] 已在 config gate 检查前完成 phase 校验
- [ ] 已检查 config gate（`workflow.code_review`）
- [ ] 已验证 `REVIEW.md` 存在（缺失时报错）
- [ ] 已检查 `REVIEW.md` 状态（若为 `clean/skipped` 则跳过）
- [ ] 已用正确配置启动 agent（`review_path`, `fix_scope`, `fix_report_path`）
- [ ] 已在识别部分成功可能性的前提下处理 agent 失败（可能已存在部分 fix commit）
- [ ] `--auto` 迭代循环遵守 3 次上限
- [ ] `--auto` 重新 review 使用持久化的文件范围（不会在迭代间丢失）
- [ ] `REVIEW-FIX.md` 仅在所有迭代完成后提交 **一次**（不是每轮一次）
- [ ] 在 `present_results` 中对缺失的 fix report 给出明确错误提示
- [ ] 已 inline 展示结果并给出下一步建议
</success_criteria>
