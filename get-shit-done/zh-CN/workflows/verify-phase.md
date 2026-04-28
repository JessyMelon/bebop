<purpose>
通过从目标反推的方式验证阶段目标是否达成。检查代码库是否真正交付了该阶段承诺的结果，而不只是任务完成。

由从 execute-phase.md 启动的 verification subagent 执行。
</purpose>

<core_principle>
**任务完成 ≠ 目标达成**

当某个组件只是占位符时，任务“create chat component”也可能被标记为完成。任务完成了，但“working chat interface”这个目标并没有达成。

从目标反推的验证方式：
1. 要达成这个目标，哪些事实必须为 TRUE？
2. 要让这些事实成立，哪些内容必须 EXIST？
3. 要让这些产物真正工作，哪些连接必须 WIRED？
4. 要证明这些事实，TESTS 必须证明什么？

然后逐层对照实际代码库进行验证。
</core_principle>

<required_reading>
@~/.claude/get-shit-done/references/verification-patterns.md
@~/.claude/get-shit-done/templates/verification-report.md
</required_reading>

<process>

<step name="load_context" priority="first">
加载 phase operation 上下文：

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中提取：`phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`。

然后加载阶段详情并列出 plans/summaries：
```bash
gsd-sdk query roadmap.get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null || true
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md 2>/dev/null || true
```

加载完整 milestone phases，用于 deferred-item 过滤（Step 9b）：
```bash
gsd-sdk query roadmap.analyze
```

从 ROADMAP.md 中提取 **phase goal**（要验证的结果，而不是任务），若存在 REQUIREMENTS.md 则提取 **requirements**，并从 roadmap analyze 中提取 **all milestone phases**（用于将缺口与后续阶段交叉比对）。
</step>

<step name="establish_must_haves">
**Option A: PLAN frontmatter 中的 must-haves**

使用 `gsd-sdk query` 的 verify handlers（或旧版 gsd-tools）从每个 PLAN 中提取 must_haves：

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(gsd-sdk query frontmatter.get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

返回 JSON：`{ truths: [...], artifacts: [...], key_links: [...] }`

汇总该阶段所有 plan 中的 must_haves，用于阶段级验证。

**Option B: 使用 ROADMAP.md 中的 Success Criteria**

如果 frontmatter 中没有 must_haves（`MUST_HAVES` 返回错误或为空），则检查是否有 Success Criteria：

```bash
PHASE_DATA=$(gsd-sdk query roadmap.get-phase "${phase_number}" --raw)
```

从 JSON 输出中解析 `success_criteria` 数组。若非空：
1. 直接将每个 Success Criterion 作为 **truth** 使用（它们本来就是可观察、可测试的行为）
2. 推导 **artifacts**（每个 truth 对应的具体文件路径）
3. 推导 **key links**（最容易隐藏 stub 的关键连接）
4. 继续前先记录这些 must-haves

ROADMAP.md 中的 Success Criteria 是契约，当它与 PLAN 级 must_haves 同时存在时，以它为准。

**Option C: 从 phase goal 推导（回退）**

如果 frontmatter 中没有 must_haves，且 ROADMAP 中也没有 Success Criteria：
1. 陈述 ROADMAP.md 中的目标
2. 推导 **truths**（3-7 个可观察行为，每个都可测试）
3. 推导 **artifacts**（每个 truth 对应的具体文件路径）
4. 推导 **key links**（最容易隐藏 stub 的关键连接）
5. 继续前记录推导出的 must-haves
</step>

<step name="verify_truths">
对每个可观察 truth，判断代码库是否支持它。

**Status:** ✓ VERIFIED（所有支撑产物都通过） | ✗ FAILED（产物缺失/是 stub/未接线） | ? UNCERTAIN（需要人工）

对每个 truth：识别支撑产物 → 检查产物状态 → 检查接线 → 判定 truth 状态。

**示例：** truth “User can see existing messages” 依赖 Chat.tsx（渲染）、/api/chat GET（提供数据）、Message model（schema）。如果 Chat.tsx 是 stub，或 API 返回硬编码的 [] → FAILED。如果这些都存在、内容充实且已连接 → VERIFIED。
</step>

<step name="verify_artifacts">
使用 `gsd-sdk query verify.artifacts`（或旧版 gsd-tools）对每个 PLAN 中 must_haves 对应的 artifacts 做验证：

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(gsd-sdk query verify.artifacts "$plan")
  echo "=== $plan ===" && echo "$ARTIFACT_RESULT"
done
```

解析 JSON 结果：`{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

**根据结果判定 artifact 状态：**
- `exists=false` → MISSING
- `issues` 非空 → STUB（检查 issues 中是否有 "Only N lines" 或 "Missing pattern"）
- `passed=true` → VERIFIED（Level 1-2 通过）

**Level 3 — Wired（对通过 Level 1-2 的 artifacts 进行手动检查）：**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx"  # IMPORTED
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import"  # USED
```
WIRED = imported AND used。ORPHANED = 存在但未被 imported/used。

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |

**导出级 spot check（WARNING 严重级别）：**

对通过 Level 3 的 artifacts，抽查单个导出：
- 提取关键导出符号（functions、constants、classes；跳过 types/interfaces）
- 对每个导出，在定义文件之外 grep 它的使用情况
- 将没有任何外部调用点的导出标记为 "exported but unused"

这能抓到像 `setPlan()` 这样的死代码：文件本身已接线，但函数实际上从未被调用。按 WARNING 报告，这可能意味着跨计划接线未完成，或是计划修订遗留代码。
</step>

<step name="verify_wiring">
使用 `gsd-sdk query verify.key-links`（或旧版 gsd-tools）对每个 PLAN 中 must_haves 对应的 key links 做验证：

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(gsd-sdk query verify.key-links "$plan")
  echo "=== $plan ===" && echo "$LINKS_RESULT"
done
```

解析 JSON 结果：`{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

**根据结果判定 link 状态：**
- `verified=true` → WIRED
- `verified=false` 且包含 "not found" → NOT_WIRED
- `verified=false` 且包含 "Pattern not found" → PARTIAL

**回退模式（如果 must_haves 中没有 key_links）：**

| Pattern | Check | Status |
|---------|-------|--------|
| Component → API | fetch/axios call to API path, response used (await/.then/setState) | WIRED / PARTIAL (call but unused response) / NOT_WIRED |
| API → Database | Prisma/DB query on model, result returned via res.json() | WIRED / PARTIAL (query but not returned) / NOT_WIRED |
| Form → Handler | onSubmit with real implementation (fetch/axios/mutate/dispatch), not console.log/empty | WIRED / STUB (log-only/empty) / NOT_WIRED |
| State → Render | useState variable appears in JSX (`{stateVar}` or `{stateVar.property}`) | WIRED / NOT_WIRED |

记录每个 key link 的状态和证据。
</step>

<step name="verify_requirements">
如果存在 REQUIREMENTS.md：
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null || true
```

对每条 requirement：解析描述 → 识别支撑 truths/artifacts → 状态为 ✓ SATISFIED / ✗ BLOCKED / ? NEEDS HUMAN。
</step>

<step name="behavioral_verification">
**运行项目测试套件和 CLI 命令，验证行为，而不只是结构。**

静态检查（grep、文件存在性、接线情况）能发现结构性缺口，但抓不到运行期故障。此步骤通过运行真实测试和项目命令，验证该阶段目标在行为层面是否达成。

这遵循 Anthropic 的 harness engineering 原则：将生成与评估分离，让评估器与正在运行的系统交互，而不是只检查静态产物。

**Step 1: 运行测试套件**

```bash
# Resolve test command: project config > Makefile > language sniff
TEST_CMD=$(gsd-sdk query config-get workflow.test_command --default "" 2>/dev/null || true)
if [ -z "$TEST_CMD" ]; then
  if [ -f "Makefile" ] && grep -q "^test:" Makefile; then
    TEST_CMD="make test"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then
    TEST_CMD="just test"
  elif [ -f "package.json" ]; then
    TEST_CMD="npm test"
  elif [ -f "Cargo.toml" ]; then
    TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then
    TEST_CMD="go test ./..."
  elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
    TEST_CMD="python -m pytest -q --tb=short 2>&1 || uv run python -m pytest -q --tb=short"
  else
    TEST_CMD="false"
    echo "⚠ No test runner detected — skipping test suite"
  fi
fi
# Detect test runner and run all tests (timeout: 5 minutes)
TEST_EXIT=0
timeout 300 bash -c "$TEST_CMD" 2>&1
TEST_EXIT=$?
if [ "${TEST_EXIT}" -eq 0 ]; then
  echo "✓ Test suite passed"
elif [ "${TEST_EXIT}" -eq 124 ]; then
  echo "⚠ Test suite timed out after 5 minutes"
else
  echo "✗ Test suite failed (exit code ${TEST_EXIT})"
fi
```

记录：总测试数、通过数、失败数、覆盖率（若可用）。

**如果有任何测试失败：** 标记为 `behavioral_failures`，无论静态检查是否通过都属于 BLOCKER 级别。测试失败时，该阶段不能视为已验证。

**Step 2: 运行 success criteria 中的项目 CLI/命令（如果可测试）**

对于每个描述用户命令的 success criterion（例如 “User can run `mixtiq validate`”、"User can run `npm start`"）：

1. 检查命令是否存在，以及所需输入是否可用：
   - 在 `templates/`、`fixtures/`、`test/`、`examples/` 或 `testdata/` 中查找示例文件
   - 检查 CLI 二进制/脚本是否在 PATH 上，或是否存在于项目中
2. **如果没有合适的输入或 fixtures：** 标记为 `? NEEDS HUMAN`，原因写为
   "No test fixtures available — requires manual verification"，然后继续。
   不要编造示例输入。
3. 如果有可用输入：运行命令并验证其成功退出。

```bash
# Only run if both command and input exist
if command -v {project_cli} &>/dev/null && [ -f "{example_input}" ]; then
  {project_cli} {example_input} 2>&1
fi
```

记录：命令、退出码、输出摘要、通过/失败（若无 fixtures 则记为 SKIPPED）。

**Step 3: 报告**

```
## Behavioral Verification

| Check | Result | Detail |
|-------|--------|--------|
| Test suite | {N} passed, {M} failed | {first failure if any} |
| {CLI command 1} | ✓ / ✗ | {output summary} |
| {CLI command 2} | ✓ / ✗ | {output summary} |
```

**如果所有行为检查都通过：** 继续到 scan_antipatterns。
**如果任一项失败：** 以 BLOCKER 严重级别加入 verification gaps。
</step>

<step name="scan_antipatterns">
从 SUMMARY.md 中提取该阶段修改过的文件，并扫描每个文件：

| Pattern | Search | Severity |
|---------|--------|----------|
| TODO/FIXME/XXX/HACK | `grep -n -E "TODO\|FIXME\|XXX\|HACK"` | ⚠️ Warning |
| Placeholder content | `grep -n -iE "placeholder\|coming soon\|will be here"` | 🛑 Blocker |
| Empty returns | `grep -n -E "return null\|return \{\}\|return \[\]\|=> \{\}"` | ⚠️ Warning |
| Log-only functions | Functions containing only console.log | ⚠️ Warning |

分类为：🛑 Blocker（阻止目标达成）| ⚠️ Warning（未完成）| ℹ️ Info（值得注意）。
</step>

<step name="audit_test_quality">
**验证测试是否真的证明了它声称证明的内容。**

此步骤用于识别能骗过前面所有检查的测试层问题：文件存在、内容充实、已接线、测试也通过了，但测试实际上并没有验证需求。

**1. 识别与需求关联的测试文件**

从 PLAN 和 SUMMARY 文件中，将每条需求映射到应该用于证明它的测试文件。

**2. Disabled test 扫描**

对所有与需求关联的测试文件，搜索 disabled/skipped 模式：

```bash
grep -rn -E "it\.skip|describe\.skip|test\.skip|xit\(|xdescribe\(|xtest\(|@pytest\.mark\.skip|@unittest\.skip|#\[ignore\]|\.pending|it\.todo|test\.todo" "$TEST_FILE"
```

**规则：** 与某条需求关联的 disabled test = 该需求未被测试。
- 如果该 disabled test 是唯一证明该需求的测试 → 🛑 BLOCKER
- 如果其他启用中的测试也覆盖了该需求 → ⚠️ WARNING

**3. Circular test 检测**

搜索通过运行被测系统来生成期望值的脚本/工具：

```bash
grep -rn -E "writeFileSync|writeFile|fs\.write|open\(.*w\)" "$TEST_DIRS"
```

对每个匹配项，检查它是否同时导入了被测 system/service/module。如果某个脚本既导入 system-under-test，又写入期望输出值 → CIRCULAR。

**Circular test 指标：**
- 脚本导入 service，同时写入 fixture 文件
- 期望值带有诸如 "computed from engine"、"captured from baseline" 的注释
- 在测试上下文中，脚本文件名包含 "capture"、"baseline"、"generate"、"snapshot"
- 期望值与测试断言在同一个 commit 中一起加入

**规则：** 若测试将系统输出与由同一系统生成的值做比较，就是循环测试。它只能证明一致性，不能证明正确性。

**4. 期望值来源**（适用于 comparison/parity/migration 类需求）

当某条需求要求与外部来源比较（"identical to X"、"matches Y"、"same output as Z"）时：

- 测试流水线里是否真的调用或引用了外部来源？
- fixture 文件里的数据是否来自外部系统？
- 还是所有期望值都来自新系统本身，或来自数学公式？

**来源分类：**
- VALID：期望值来自外部/旧系统输出、人工采集结果或独立 oracle
- PARTIAL：期望值来自数学推导（可证明公式，不代表系统匹配）
- CIRCULAR：期望值来自被测系统
- UNKNOWN：没有来源信息，按 SUSPECT 处理

**5. 断言强度**

对每个与需求关联的测试，给其最强断言分级：

| Level | Examples | Proves |
|-------|---------|--------|
| Existence | `toBeDefined()`, `!= null` | Something returned |
| Type | `typeof x === 'number'` | Correct shape |
| Status | `code === 200` | No error |
| Value | `toEqual(expected)`, `toBeCloseTo(x)` | Specific value |
| Behavioral | Multi-step workflow assertions | End-to-end correctness |

如果某条需求需要 value-level 或 behavioral-level 证据，而测试只有 existence/type/status 断言 → INSUFFICIENT。

**6. 覆盖数量**

如果需求指定了测试用例数量（例如 "30 calculations"），检查实际启用中的测试用例数（非 skipped）是否满足要求。

**Reporting — 添加到 VERIFICATION.md：**

```markdown
### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|----------------|---------|

**Disabled tests on requirements:** {N} → {BLOCKER if any req has ONLY disabled tests}
**Circular patterns detected:** {N} → {BLOCKER if any}
**Insufficient assertions:** {N} → {WARNING}
```

**对状态的影响：** 只要测试质量审计发现任何 BLOCKER，整体状态就设为 `gaps_found`，无论其他检查是否通过。
</step>

<step name="identify_human_verification">
**首先：判断这是否是基础设施/底层阶段。**

基础设施和底层阶段，如代码基础、数据库 schema、内部 API、数据模型、构建工具、CI/CD、内部服务集成，按定义都没有用户可见元素。对这些阶段：

- 不要编造人为的手动步骤（例如 "manually run git commits"、"manually invoke methods"、"manually check database state"）。
- 将人工验证标记为 **N/A**，原因："Infrastructure/foundation phase — no user-facing elements to test manually."
- 设置 `human_verification: []`，且不要仅因为缺少用户可见功能就产出 `human_needed` 状态。
- 只有在阶段目标或 success criteria 明确描述了用户会交互的内容时，才添加人工验证项（UI、终端用户可见的 CLI 输出、外部服务 UX）。

**如何判断一个阶段是否属于基础设施/底层：**
- 阶段名称或目标包含："foundation"、"infrastructure"、"schema"、"database"、"internal API"、"data model"、"scaffolding"、"pipeline"、"tooling"、"CI"、"migrations"、"service layer"、"backend"、"core library"
- 阶段 success criteria 只描述技术产物（文件存在、测试通过、schema 有效），不需要用户交互
- 没有 UI、没有终端用户可见的 CLI 输出，也没有可观察的实时行为

**如果该阶段属于基础设施/底层：** 自动通过 UAT，完全跳过人工验证项列表。记录：

```markdown
## Human Verification

N/A — Infrastructure/foundation phase with no user-facing elements.
All acceptance criteria are verifiable programmatically.
```

**如果该阶段是用户可见的：** 只标记真正需要人工判断的项。不要编造步骤。

**始终需要人工（仅限用户可见阶段）：** 视觉呈现、用户流程是否完整、实时行为（WebSocket/SSE）、外部服务集成、性能体感、错误消息是否清晰。

**不确定时需要人工（仅限用户可见阶段）：** grep 难以追踪的复杂接线、依赖动态状态的行为、边界情况。

格式统一为：Test Name → What to do → Expected result → Why can't verify programmatically.
</step>

<step name="determine_status">
按以下决策树**依次**分类状态（从最严格开始）：

1. 如果任一 truth FAILED、artifact 为 MISSING/STUB、key link 为 NOT_WIRED、发现 blocker，**或测试质量审计发现 blocker（被禁用的需求测试、循环测试）**：
   → **gaps_found**

2. 如果上一步产出了任何 human verification 项：
   → **human_needed**（即使所有 truths 都 VERIFIED 且分数为 N/N）

3. 如果所有检查都通过，且没有 human verification 项：
   → **passed**

**只有在不存在任何 human verification 项时，`passed` 才有效。**

**Score:** `verified_truths / total_truths`
</step>

<step name="filter_deferred_items">
报告 gaps 之前，使用 load_context 中加载的完整 roadmap 数据（来自 `roadmap analyze`），将每个 gap 与同一 milestone 的后续阶段交叉比对。

对 determine_status 中识别出的每个潜在 gap：
1. 检查该 gap 对应的失败 truth 或缺失项，是否由后续某个阶段的 goal 或 success criteria 覆盖
2. **匹配标准：** 该 gap 的关注点明确出现在后续阶段的 goal 文本、success criteria 文本中，或后续阶段的名称明显表明它覆盖该领域
3. 如果存在明确匹配 → 将该 gap 移到 `deferred` 列表，并附上匹配阶段引用和证据文本
4. 如果任何后续阶段中都没有匹配 → 保留为真实 `gap`

**重要：** 保守处理。只有在后续阶段存在清晰、具体证据时才延后一个 gap。模糊或牵强的匹配**不应**触发延后；拿不准时，保留为真实 gap。

**Deferred items 不影响状态判定。** 过滤后重新计算：
- 如果 gaps 列表为空，且没有 human 项 → `passed`
- 如果 gaps 列表为空，但有 human 项 → `human_needed`
- 如果 gaps 列表仍有项 → `gaps_found`

为透明起见，在 VERIFICATION.md 的 frontmatter（`deferred:` section）和正文（Deferred Items table）中包含 deferred items。如果不存在 deferred items，则省略这些部分。
</step>

<step name="generate_fix_plans">
如果是 gaps_found：

1. **聚类相关 gaps：** API stub + component 未接线 → "Wire frontend to backend"。多个缺失项 → "Complete core implementation"。仅有接线问题 → "Connect existing components"。

2. **为每个聚类生成计划：** Objective、2-3 个任务（files/action/verify 各项）、re-verify step。保持聚焦：每个计划只处理一个问题。

3. **按依赖排序：** 先修复缺失项 → 再修复 stubs → 再修复接线 → **再修复测试证据** → 最后验证。
</step>

<step name="create_report">
```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

填充模板各部分：frontmatter（phase/timestamp/status/score）、goal achievement、artifact table、wiring table、requirements coverage、anti-patterns、human verification、gaps summary、fix plans（若为 gaps_found）、metadata。

完整模板见 `~/.claude/get-shit-done/templates/verification-report.md`。
</step>

<step name="return_to_orchestrator">
返回 status（`passed` | `gaps_found` | `human_needed`）、score（N/M must-haves）、report path。

如果是 gaps_found：列出 gaps 和推荐的 fix plan 名称。
如果是 human_needed：列出需要人工测试的项。

Orchestrator 路由：`passed` → update_roadmap | `gaps_found` → create/execute fixes, re-verify | `human_needed` → present to user。
</step>

</process>

<success_criteria>
- [ ] 已建立 must-haves（来自 frontmatter 或推导）
- [ ] 已验证所有 truths，并给出状态和证据
- [ ] 已在全部三个层级检查所有 artifacts
- [ ] 已验证所有 key links
- [ ] 已评估 requirements coverage（如适用）
- [ ] 已扫描并分类 anti-patterns
- [ ] 已审计测试质量（disabled tests、circular patterns、assertion strength、provenance）
- [ ] 已识别 human verification 项
- [ ] 已确定整体状态
- [ ] 已根据后续 milestone phases 过滤 deferred items（若发现 gaps）
- [ ] 已生成 fix plans（若过滤后仍为 gaps_found）
- [ ] 已创建带完整报告的 VERIFICATION.md
- [ ] 已将结果返回给 orchestrator
</success_criteria>
