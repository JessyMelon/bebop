<purpose>
审计已完成阶段中的 Nyquist 验证缺口。生成缺失测试。更新 VALIDATION.md。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-nyquist-auditor — 验证校验覆盖率
</available_agent_types>

<process>

## 0. 初始化

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_AUDITOR=$(gsd-sdk query agent-skills gsd-nyquist-auditor 2>/dev/null)
```

解析：`phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`。

```bash
AUDITOR_MODEL=$(gsd-sdk query resolve-model gsd-nyquist-auditor --raw)
NYQUIST_CFG=$(gsd-sdk query config-get workflow.nyquist_validation --raw)
```

如果 `NYQUIST_CFG` 为 `false`：退出并显示 "Nyquist validation is disabled. Enable via /gsd-settings."。

显示横幅：`GSD > VALIDATE PHASE {N}: {name}`

## 1. 检测输入状态

```bash
VALIDATION_FILE=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
```

- **状态 A**（`VALIDATION_FILE` 非空）：审计现有内容
- **状态 B**（`VALIDATION_FILE` 为空，`SUMMARY_FILES` 非空）：从产物重建
- **状态 C**（`SUMMARY_FILES` 为空）：退出，提示 "Phase {N} not executed. Run /gsd-execute-phase {N} ${GSD_WS} first."

## 2. 发现

### 2a. 读取阶段产物

读取所有 PLAN 和 SUMMARY 文件。提取：任务列表、需求 ID、变更的关键文件、verify 块。

### 2b. 构建需求到任务映射

每个任务：`{ task_id, plan_id, wave, requirement_ids, has_automated_command }`

### 2c. 检测测试基础设施

状态 A：从现有 VALIDATION.md 的 Test Infrastructure 表中解析。
状态 B：扫描文件系统：

```bash
find . -name "pytest.ini" -o -name "jest.config.*" -o -name "vitest.config.*" -o -name "pyproject.toml" 2>/dev/null | head -10
find . \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" \) -not -path "*/node_modules/*" 2>/dev/null | head -40
```

### 2d. 交叉引用

按文件名、imports、测试描述将每条需求与现有测试匹配。记录：requirement → test_file → status。

## 3. 缺口分析

对每条需求分类：

| Status | Criteria |
|--------|----------|
| COVERED | Test exists, targets behavior, runs green |
| PARTIAL | Test exists, failing or incomplete |
| MISSING | No test found |

构建：`{ task_id, requirement, gap_type, suggested_test_path, suggested_command }`

无缺口 → 跳到 Step 6，并设置 `nyquist_compliant: true`。

## 4. 展示缺口计划


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 若 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对无法使用 `AskUserQuestion` 的非-Claude runtime（OpenAI Codex、Gemini CLI 等）是必需的。
调用 AskUserQuestion 并附带缺口表及选项：
1. "Fix all gaps" → Step 5
2. "Skip — mark manual-only" → 添加到 Manual-Only，Step 6
3. "Cancel" → 退出

## 5. 启动 gsd-nyquist-auditor

```
Task(
  prompt="Read ~/.claude/agents/gsd-nyquist-auditor.md for instructions.\n\n" +
    "<files_to_read>{PLAN, SUMMARY, impl files, VALIDATION.md}</files_to_read>" +
    "<gaps>{gap list}</gaps>" +
    "<test_infrastructure>{framework, config, commands}</test_infrastructure>" +
    "<constraints>Never modify impl files. Max 3 debug iterations. Escalate impl bugs.</constraints>" +
    "${AGENT_SKILLS_AUDITOR}",
  subagent_type="gsd-nyquist-auditor",
  model="{AUDITOR_MODEL}",
  description="Fill validation gaps for Phase {N}"
)
```

处理返回：
- `## GAPS FILLED` → 记录测试和映射更新，Step 6
- `## PARTIAL` → 记录已解决项，将升级项移到 manual-only，Step 6
- `## ESCALATE` → 将全部移到 manual-only，Step 6

## 6. 生成/更新 VALIDATION.md

**状态 B（创建）：**
1. 从 `~/.claude/get-shit-done/templates/VALIDATION.md` 读取模板
2. 填充：frontmatter、Test Infrastructure、Per-Task Map、Manual-Only、Sign-Off
3. 写入 `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`

**状态 A（更新）：**
1. 更新 Per-Task Map 状态，将升级项加入 Manual-Only，并更新 frontmatter
2. 追加审计记录：

```markdown
## Validation Audit {date}
| Metric | Count |
|--------|-------|
| Gaps found | {N} |
| Resolved | {M} |
| Escalated | {K} |
```

## 7. 提交

```bash
git add {test_files}
git commit -m "test(phase-${PHASE}): add Nyquist validation tests"

gsd-sdk query commit "docs(phase-${PHASE}): add/update validation strategy"
```

## 8. 结果与路由

**符合要求：**
```
GSD > PHASE {N} IS NYQUIST-COMPLIANT
All requirements have automated verification.
▶ Next: /gsd-audit-milestone ${GSD_WS}
```

**部分完成：**
```
GSD > PHASE {N} VALIDATED (PARTIAL)
{M} automated, {K} manual-only.
▶ Retry: /gsd-validate-phase {N} ${GSD_WS}
```

显示 `/clear` 提醒。

</process>

<success_criteria>
- [ ] 已检查 Nyquist 配置（若禁用则退出）
- [ ] 已检测输入状态（A/B/C）
- [ ] 状态 C 可干净退出
- [ ] 已读取 PLAN/SUMMARY 文件并构建需求映射
- [ ] 已检测测试基础设施
- [ ] 已对缺口分类（COVERED/PARTIAL/MISSING）
- [ ] 已通过缺口表设置用户关卡
- [ ] 已在完整上下文下启动 auditor
- [ ] 已处理全部三种返回格式
- [ ] 已创建或更新 VALIDATION.md
- [ ] 测试文件已单独提交
- [ ] 已展示结果与后续路由
</success_criteria>
