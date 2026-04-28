<purpose>
审查某个 phase 期间变更过的源文件，查找 bug、安全问题和代码质量问题。计算文件范围（`--files` 覆盖 > `SUMMARY.md` > `git diff` 回退），检查 config gate，启动 `gsd-code-reviewer` agent，提交 `REVIEW.md`，并向用户展示结果。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<available_agent_types>
- gsd-code-reviewer: 审查源文件中的 bug 和质量问题
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

这一步在 config gate 检查之前执行，这样无论 config 状态如何，都能立即暴露用户输入错误。

从 $ARGUMENTS 中解析可选 flag：

**--depth flag:**
```bash
DEPTH_OVERRIDE=""
for arg in "$@"; do
  if [[ "$arg" == --depth=* ]]; then
    DEPTH_OVERRIDE="${arg#--depth=}"
  fi
done
```

**--files flag:**
```bash
FILES_OVERRIDE=""
for arg in "$@"; do
  if [[ "$arg" == --files=* ]]; then
    FILES_OVERRIDE="${arg#--files=}"
  fi
done
```

如果设置了 FILES_OVERRIDE，则按逗号拆分为数组：
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  IFS=',' read -ra FILES_ARRAY <<< "$FILES_OVERRIDE"
fi
```
</step>

<step name="check_config_gate">
检查是否通过 config 启用了 code review：

```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```

如果 CODE_REVIEW_ENABLED 为 "false"：
```
Code review skipped (workflow.code_review=false in config)
```
退出 workflow。

默认值为 true，只有显式为 false 时才跳过。此检查在 phase validation 之后执行，因此无效 phase 的错误会优先显示。
</step>

<step name="resolve_depth">
按以下优先级确定 review depth：

1. 来自 `--depth` flag 的 `DEPTH_OVERRIDE`（最高优先级）
2. Config 值：`gsd-sdk query config-get workflow.code_review_depth 2>/dev/null`
3. 默认值：`"standard"`

```bash
if [ -n "$DEPTH_OVERRIDE" ]; then
  REVIEW_DEPTH="$DEPTH_OVERRIDE"
else
  CONFIG_DEPTH=$(gsd-sdk query config-get workflow.code_review_depth 2>/dev/null || echo "")
  REVIEW_DEPTH="${CONFIG_DEPTH:-standard}"
fi
```

**Validate depth value:**
```bash
case "$REVIEW_DEPTH" in
  quick|standard|deep)
    # Valid
    ;;
  *)
    echo "Warning: Invalid depth '${REVIEW_DEPTH}'. Valid values: quick, standard, deep. Using 'standard'."
    REVIEW_DEPTH="standard"
    ;;
esac
```
</step>

<step name="compute_file_scope">
采用显式优先级的三层范围计算：

**Tier 1 — --files override (highest precedence per D-08):**

如果设置了 FILES_OVERRIDE（来自 `--files` flag）：
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  REVIEW_FILES=()
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  
  for file_path in "${FILES_ARRAY[@]}"; do
    # Security: validate path is within repository (prevent path traversal)
    ABS_PATH=$(realpath -m "${file_path}" 2>/dev/null || echo "${file_path}")
    if [[ "$ABS_PATH" != "$REPO_ROOT"* ]]; then
      echo "Error: File path outside repository, skipping: ${file_path}"
      continue
    fi
    
    # Validate path exists (relative to repo root)
    if [ -f "${REPO_ROOT}/${file_path}" ] || [ -f "${file_path}" ]; then
      REVIEW_FILES+=("$file_path")
    else
      echo "Warning: File not found, skipping: ${file_path}"
    fi
  done
  
  echo "File scope: ${#REVIEW_FILES[@]} files from --files override"
fi
```

提供了 `--files` 时，完全跳过 SUMMARY/git 范围计算。

**Tier 2 — SUMMARY.md extraction (primary per D-01):**

如果未提供 `--files`：
```bash
if [ -z "$FILES_OVERRIDE" ]; then
  SUMMARIES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
  REVIEW_FILES=()
  
  if [ -n "$SUMMARIES" ]; then
    for summary in $SUMMARIES; do
      # Extract key_files.created and key_files.modified using node for reliable YAML parsing
      # This avoids fragile awk parsing that breaks on indentation differences
      EXTRACTED=$(node -e "
        const fs = require('fs');
        const content = fs.readFileSync('$summary', 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) { process.exit(0); }
        const yaml = match[1];
        const files = [];
        let inSection = null;
        for (const line of yaml.split('\n')) {
          if (/^\s+created:/.test(line)) { inSection = 'created'; continue; }
          if (/^\s+modified:/.test(line)) { inSection = 'modified'; continue; }
          if (/^\s*\w+:/.test(line) && !/^\s*-/.test(line)) { inSection = null; continue; }
          if (inSection && /^\s+-\s+(.+)/.test(line)) {
            files.push(line.match(/^\s+-\s+(.+)/)[1].trim());
          }
        }
        if (files.length) console.log(files.join('\n'));
      " 2>/dev/null)
      
      # Add extracted files to REVIEW_FILES array
      if [ -n "$EXTRACTED" ]; then
        while IFS= read -r file; do
          if [ -n "$file" ]; then
            REVIEW_FILES+=("$file")
          fi
        done <<< "$EXTRACTED"
      fi
    done
    
    if [ ${#REVIEW_FILES[@]} -eq 0 ]; then
      echo "Warning: SUMMARY artifacts found but contained no file paths. Falling back to git diff."
    fi
  fi
fi
```

**Tier 3 — Git diff fallback (per D-02):**

如果未找到 `SUMMARY.md` 文件，或未能从中提取出任何文件：
```bash
if [ ${#REVIEW_FILES[@]} -eq 0 ]; then
  # Compute diff base from phase commits — fail closed if no reliable base found
  PHASE_COMMITS=$(git log --oneline --all --grep="${PADDED_PHASE}" --format="%H" 2>/dev/null)
  
  if [ -n "$PHASE_COMMITS" ]; then
    DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)^
    
    # Verify the parent commit exists (first commit in repo has no parent)
    if ! git rev-parse "${DIFF_BASE}" >/dev/null 2>&1; then
      DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)
    fi
    
    # Run git diff with specific exclusions (per D-03)
    DIFF_FILES=$(git diff --name-only "${DIFF_BASE}..HEAD" -- . \
      ':!.planning/' ':!ROADMAP.md' ':!STATE.md' \
      ':!*-SUMMARY.md' ':!*-VERIFICATION.md' ':!*-PLAN.md' \
      ':!package-lock.json' ':!yarn.lock' ':!Gemfile.lock' ':!poetry.lock' 2>/dev/null)
    
    while IFS= read -r file; do
      [ -n "$file" ] && REVIEW_FILES+=("$file")
    done <<< "$DIFF_FILES"
    
    echo "File scope: ${#REVIEW_FILES[@]} files from git diff (base: ${DIFF_BASE})"
  else
    # Fail closed — no reliable diff base found. Do not use arbitrary HEAD~N.
    echo "Warning: No phase commits found for '${PADDED_PHASE}'. Cannot determine reliable diff scope."
    echo "Use --files flag to specify files explicitly: /gsd-code-review ${PHASE_ARG} --files=file1,file2,..."
  fi
fi
```

**Post-processing (all tiers):**

1. **Apply exclusions (per D-03):** 移除匹配 planning 产物的路径
```bash
FILTERED_FILES=()
for file in "${REVIEW_FILES[@]}"; do
  # Skip planning directory and specific artifacts
  if [[ "$file" == .planning/* ]] || \
     [[ "$file" == ROADMAP.md ]] || \
     [[ "$file" == STATE.md ]] || \
     [[ "$file" == *-SUMMARY.md ]] || \
     [[ "$file" == *-VERIFICATION.md ]] || \
     [[ "$file" == *-PLAN.md ]]; then
    continue
  fi
  FILTERED_FILES+=("$file")
done
REVIEW_FILES=("${FILTERED_FILES[@]}")
```

2. **Filter deleted files:** 移除磁盘上不存在的路径
```bash
EXISTING_FILES=()
DELETED_COUNT=0
for file in "${REVIEW_FILES[@]}"; do
  if [ -f "$file" ]; then
    EXISTING_FILES+=("$file")
  else
    DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
done
REVIEW_FILES=("${EXISTING_FILES[@]}")

if [ $DELETED_COUNT -gt 0 ]; then
  echo "Filtered $DELETED_COUNT deleted files from review scope"
fi
```

3. **Deduplicate:** 去重路径（可移植，兼容 bash 3.2+，可处理带空格的路径）
```bash
DEDUPED=()
while IFS= read -r line; do
  [ -n "$line" ] && DEDUPED+=("$line")
done < <(printf '%s\n' "${REVIEW_FILES[@]}" | sort -u)
REVIEW_FILES=("${DEDUPED[@]}")
```

4. **Sort:** 按字母顺序排序，以便生成可复现的 agent 输入（上面的 `sort -u` 已完成排序）

**Log final scope and warn if large:**
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  TIER="--files override"
elif [ -n "$SUMMARIES" ] && [ ${#REVIEW_FILES[@]} -gt 0 ]; then
  TIER="SUMMARY.md"
else
  TIER="git diff"
fi
echo "File scope: ${#REVIEW_FILES[@]} files from ${TIER}"

# Warn if file count is very large — may exceed agent context or produce superficial review
if [ ${#REVIEW_FILES[@]} -gt 50 ]; then
  echo "Warning: ${#REVIEW_FILES[@]} files is a large review scope."
  echo "Consider using --files to narrow scope, or --depth=quick for a faster pass."
  if [ "$REVIEW_DEPTH" = "deep" ]; then
    echo "Switching from deep to standard depth for large file count."
    REVIEW_DEPTH="standard"
  fi
fi
```
</step>

<step name="check_empty_scope">
如果 `REVIEW_FILES` 为空：
```
No source files changed in phase ${PHASE_ARG}. Skipping review.
```
退出 workflow。不要启动 agent，也不要创建 `REVIEW.md`。
</step>

<step name="spawn_reviewer">
计算 review 输出路径：
```bash
REVIEW_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW.md"
```

为 agent 上下文计算 `DIFF_BASE`（如果 agent 需要）：
```bash
PHASE_COMMITS=$(git log --oneline --all --grep="${PADDED_PHASE}" --format="%H" 2>/dev/null)
if [ -n "$PHASE_COMMITS" ]; then
  DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)^
else
  DIFF_BASE=""
fi
```

为 agent 构建 `files_to_read` 块：
```bash
FILES_TO_READ=""
for file in "${REVIEW_FILES[@]}"; do
  FILES_TO_READ+="- ${file}\n"
done
```

为 agent 构建 config 块：
```bash
CONFIG_FILES=""
for file in "${REVIEW_FILES[@]}"; do
  CONFIG_FILES+="  - ${file}\n"
done
```

启动 `gsd-code-reviewer` agent：

```
Task(subagent_type="gsd-code-reviewer", prompt="
<files_to_read>
${FILES_TO_READ}
</files_to_read>

<config>
depth: ${REVIEW_DEPTH}
phase_dir: ${PHASE_DIR}
review_path: ${REVIEW_PATH}
${DIFF_BASE:+diff_base: ${DIFF_BASE}}
files:
${CONFIG_FILES}
</config>

Review the listed source files at ${REVIEW_DEPTH} depth. Write findings to ${REVIEW_PATH}.
Do NOT commit the output — the orchestrator handles that.
")
```

**Agent failure handling:**

如果 `Task()` 调用失败（agent 错误、超时或异常）：
```
Error: Code review agent failed: ${error_message}

No REVIEW.md created. You can retry with /gsd-code-review ${PHASE_ARG} or check agent logs.
```

不要继续执行 `commit_review` 步骤。不要创建部分或空的 `REVIEW.md`。退出 workflow。
</step>

<step name="commit_review">
agent 成功完成后，验证 `REVIEW.md` 已创建且结构有效：

```bash
if [ -f "${REVIEW_PATH}" ]; then
  # Validate REVIEW.md has valid YAML frontmatter with status field
  HAS_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
    const fs = require('fs');
    const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match && /status:/.test(match[1])) { console.log('valid'); } else { console.log('invalid'); }
  " 2>/dev/null)
  
  if [ "$HAS_STATUS" = "valid" ]; then
    echo "REVIEW.md created at ${REVIEW_PATH}"
    
    if [ "$COMMIT_DOCS" = "true" ]; then
      gsd-sdk query commit \
        "docs(${PADDED_PHASE}): add code review report" \
        --files "${REVIEW_PATH}"
    fi
  else
    echo "Warning: REVIEW.md exists but has invalid or missing frontmatter (no status field)."
    echo "Agent may have produced malformed output. Not committing. Review manually: ${REVIEW_PATH}"
  fi
else
  echo "Warning: Agent completed but REVIEW.md not found at ${REVIEW_PATH}. This may indicate an agent issue."
  echo "No REVIEW.md to commit. Please retry with /gsd-code-review ${PHASE_ARG}"
fi
```
</step>

<step name="present_results">
读取 `REVIEW.md` 的 YAML frontmatter，以提取 finding 计数。

先提取 `---` 分隔符之间的 frontmatter，避免匹配到 review 正文中的值：

```bash
# Extract only the YAML frontmatter block (between first two --- lines)
FRONTMATTER=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) process.stdout.write(match[1]);
" 2>/dev/null)

# Parse fields from frontmatter only (not full file)
STATUS=$(echo "$FRONTMATTER" | grep "^status:" | cut -d: -f2 | xargs)
FILES_REVIEWED=$(echo "$FRONTMATTER" | grep "^files_reviewed:" | cut -d: -f2 | xargs)
CRITICAL=$(echo "$FRONTMATTER" | grep "critical:" | head -1 | cut -d: -f2 | xargs)
WARNING=$(echo "$FRONTMATTER" | grep "warning:" | head -1 | cut -d: -f2 | xargs)
INFO=$(echo "$FRONTMATTER" | grep "info:" | head -1 | cut -d: -f2 | xargs)
TOTAL=$(echo "$FRONTMATTER" | grep "total:" | head -1 | cut -d: -f2 | xargs)
```

向用户展示 inline 摘要：

```
═══════════════════════════════════════════════════════════════

  Code Review Complete: Phase ${PHASE_NUMBER} (${PHASE_NAME})

───────────────────────────────────────────────────────────────

  Depth:           ${REVIEW_DEPTH}
  Files Reviewed:  ${FILES_REVIEWED}
  
  Findings:
    Critical:  ${CRITICAL}
    Warning:   ${WARNING}
    Info:      ${INFO}
    ──────────
    Total:     ${TOTAL}

───────────────────────────────────────────────────────────────
```

如果 status 为 `"clean"`：
```
✓ No issues found. All ${FILES_REVIEWED} files pass review at ${REVIEW_DEPTH} depth.

Full report: ${REVIEW_PATH}
```

如果总 finding 数大于 0：
```
⚠ Issues found. Review the report for details.

Full report: ${REVIEW_PATH}

Next steps:
  /gsd-code-review-fix ${PHASE_NUMBER}  — Auto-fix issues
  cat ${REVIEW_PATH}                     — View full report
```

如果 `critical > 0` 或 `warning > 0`，则 inline 列出前 3 个问题：
```bash
echo "Top issues:"
grep -A 3 "^### CR-\|^### WR-" "${REVIEW_PATH}" | head -n 12
```

**Note on tests:** 该命令与 workflow 的自动化测试计划在 Phase 4（Pipeline Integration & Testing，requirement `INFR-03`）中补齐。Phase 2 重点是正确实现；Phase 4 会增加跨平台回归覆盖。

═══════════════════════════════════════════════════════════════
</step>

</process>

<platform_notes>
**Windows:** 此 workflow 使用 bash 特性（数组、process substitution）。在 Windows 上需要 Git Bash 或 WSL。不支持原生 PowerShell。CI matrix（Ubuntu/macOS/Windows）在 Windows runner 上通过 Git Bash 运行，因此具备 bash 兼容性。

**macOS:** macOS 自带 bash 3.2（受 GPL 许可影响）。此 workflow **不**使用 `mapfile`（仅 bash 4+ 可用），所有数组构造都使用兼容 bash 3.2 的可移植 `while IFS= read -r` 循环。`--files` 的路径校验使用 `realpath -m`，需要 GNU coreutils（可通过 `brew install coreutils` 安装）。如果没有 coreutils，路径保护会回退为 fail-closed 行为（拒绝无法验证的路径），因此安全性仍然保留，但合法的相对路径可能会被拒绝。如果在 macOS 上 `--files` 校验出现意外失败，请安装 coreutils 或改用绝对路径。
</platform_notes>

<success_criteria>
- [ ] 已在 config gate 检查前完成 phase 校验
- [ ] 已检查 config gate（`workflow.code_review`）
- [ ] 已解析并校验 depth（`quick|standard|deep`）
- [ ] 已用 3 层机制计算文件范围：`--files > SUMMARY.md > git diff`
- [ ] 已妥善处理格式错误/缺失的 `SUMMARY.md`，并能回退
- [ ] 已将已删除文件从范围中过滤掉
- [ ] 文件已去重并排序
- [ ] 空范围会导致跳过（不启动 agent）
- [ ] 已用显式文件列表、depth、`review_path`、`diff_base` 启动 agent
- [ ] 已在无部分提交的前提下处理 agent 失败
- [ ] 若已创建则提交 `REVIEW.md`
- [ ] 已 inline 展示结果并给出下一步建议
</success_criteria>
