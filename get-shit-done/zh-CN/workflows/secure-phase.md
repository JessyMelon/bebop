<purpose>
验证已完成 phase 的威胁缓解措施。确认 PLAN.md 威胁登记中的处置项都已解决。更新 SECURITY.md。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 `general-purpose`）：
- gsd-security-auditor — 验证威胁缓解覆盖情况
</available_agent_types>

<process>

## 0. 初始化

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_AUDITOR=$(gsd-sdk query agent-skills gsd-security-auditor 2>/dev/null)
```

解析：`phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`。

```bash
AUDITOR_MODEL=$(gsd-sdk query resolve-model gsd-security-auditor --raw)
SECURITY_CFG=$(gsd-sdk query config-get workflow.security_enforcement --raw 2>/dev/null || echo "true")
```

如果 `SECURITY_CFG` 为 `false`：退出并提示 "Security enforcement disabled. Enable via /gsd-settings."

显示横幅：`GSD > SECURE PHASE {N}: {name}`

## 1. 检测输入状态

```bash
SECURITY_FILE=$(ls "${PHASE_DIR}"/*-SECURITY.md 2>/dev/null | head -1)
PLAN_FILES=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
```

- **状态 A**（`SECURITY_FILE` 非空）：审计现有内容
- **状态 B**（`SECURITY_FILE` 为空，`PLAN_FILES` 和 `SUMMARY_FILES` 非空）：基于产物运行
- **状态 C**（`SUMMARY_FILES` 为空）：退出，提示 "Phase {N} not executed. Run /gsd-execute-phase {N} first."

## 2. 发现

### 2a. 读取 Phase 产物

读取 PLAN.md，提取 `<threat_model>` 区块：信任边界、STRIDE 登记（`threat_id`, `category`, `component`, `disposition`, `mitigation_plan`）。

### 2b. 读取 Summary 威胁标记

读取 SUMMARY.md，提取 `## Threat Flags` 条目。

### 2c. 构建威胁登记

按每个 threat 构建：`{ threat_id, category, component, disposition, mitigation_pattern, files_to_check }`

## 3. 威胁分类

对每个 threat 分类：

| Status | Criteria |
|--------|----------|
| CLOSED | 已找到缓解措施，或已在 SECURITY.md 记录接受风险，或已记录风险转移 |
| OPEN | 以上都不满足 |

构建：`{ threat_id, category, component, disposition, status, evidence }`

如果 `threats_open: 0`，直接跳到 Step 6。

## 4. 展示威胁处理计划

**文本模式（配置中 `workflow.text_mode: true` 或传入 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，把每次 `AskUserQuestion` 调用改为纯文本编号列表，并让用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）在没有 `AskUserQuestion` 时的必需行为。
调用 AskUserQuestion，展示 threat 表格和选项：
1. "Verify all open threats" → Step 5
2. "Accept all open — document in accepted risks log" → 写入 SECURITY.md accepted risks，将全部设为 CLOSED，进入 Step 6
3. "Cancel" → 退出

## 5. 启动 gsd-security-auditor

```
Task(
  prompt="Read ~/.claude/agents/gsd-security-auditor.md for instructions.\n\n" +
    "<files_to_read>{PLAN, SUMMARY, impl files, SECURITY.md}</files_to_read>" +
    "<threat_register>{threat register}</threat_register>" +
    "<config>asvs_level: {SECURITY_ASVS}, block_on: {SECURITY_BLOCK_ON}</config>" +
    "<constraints>Never modify implementation files. Verify mitigations exist — do not scan for new threats. Escalate implementation gaps.</constraints>" +
    "${AGENT_SKILLS_AUDITOR}",
  subagent_type="gsd-security-auditor",
  model="{AUDITOR_MODEL}",
  description="Verify threat mitigations for Phase {N}"
)
```

处理返回：
- `## SECURED` → 记录已关闭项 → Step 6
- `## OPEN_THREATS` → 记录已关闭和未关闭项，向用户展示接受/阻止选择 → Step 6
- `## ESCALATE` → 展示给用户 → Step 6

## 6. 写入/更新 SECURITY.md

**状态 B（创建）：**
1. 从 `~/.claude/get-shit-done/templates/SECURITY.md` 读取模板
2. 填充：frontmatter、threat register、accepted risks、audit trail
3. 写入 `${PHASE_DIR}/${PADDED_PHASE}-SECURITY.md`

**状态 A（更新）：**
1. 更新 threat register 状态，并追加 audit trail：

```markdown
## Security Audit {date}
| Metric | Count |
|--------|-------|
| Threats found | {N} |
| Closed | {M} |
| Open | {K} |
```

**强制关卡：** 如果在所有选项都用尽后 `threats_open > 0`（用户未接受，且也未全部验证关闭）：

```
GSD > PHASE {N} SECURITY BLOCKED
{K} threats open — phase advancement blocked until threats_open: 0
▶ Fix mitigations then re-run: /gsd-secure-phase {N}
▶ Or document accepted risks in SECURITY.md and re-run.
```

不要输出下一 phase 的路由信息。到此停止。

## 7. 提交

```bash
gsd-sdk query commit "docs(phase-${PHASE}): add/update security threat verification"
```

## 8. 结果与路由

**已安全（threats_open: 0）：**
```
GSD > PHASE {N} THREAT-SECURE
threats_open: 0 — all threats have dispositions.
▶ /gsd-validate-phase {N}    validate test coverage
▶ /gsd-verify-work {N}       run UAT
```

显示 `/clear` 提醒。

</process>

<success_criteria>
- [ ] 已检查 security enforcement，如为 false 则退出
- [ ] 已检测输入状态（A/B/C），状态 C 可正常退出
- [ ] 已解析 PLAN.md threat model，并构建登记表
- [ ] 已纳入 SUMMARY.md threat flags
- [ ] `threats_open: 0` 时可直接跳到 Step 6
- [ ] 已向用户展示带 threat 表格的关卡
- [ ] 已用完整上下文启动 auditor
- [ ] 已处理三种返回格式（SECURED/OPEN_THREATS/ESCALATE）
- [ ] 已创建或更新 SECURITY.md
- [ ] `threats_open > 0` 会阻止推进（不输出下一 phase 路由）
- [ ] 成功时已展示结果与后续路由
</success_criteria>
