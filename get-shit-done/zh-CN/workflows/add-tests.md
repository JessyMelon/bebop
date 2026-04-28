<purpose>
基于已完成 phase 的 SUMMARY.md、CONTEXT.md 和实现，生成 unit 与 E2E tests。将每个变更文件归类为 TDD（unit）、E2E（browser）或 Skip，先向用户展示 test plan 供确认，再按 RED-GREEN 约定生成 tests。

当前用户通常会在每个 phase 后手工编写 `/gsd-quick` prompt 来生成 tests。这个 workflow 将该过程标准化，补上分类、质量关卡和 gap 报告。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="parse_arguments">
解析 `$ARGUMENTS`，提取：
- Phase 编号（整数、小数或字母后缀）→ 存入 `$PHASE_ARG`
- Phase 编号后的剩余文本 → 存入 `$EXTRA_INSTRUCTIONS`（可选）

示例：`/gsd-add-tests 12 focus on edge cases` → `$PHASE_ARG=12`, `$EXTRA_INSTRUCTIONS="focus on edge cases"`

如果未提供 phase 参数：

```
ERROR: Phase number required
Usage: /gsd-add-tests <phase> [additional instructions]
Example: /gsd-add-tests 12
Example: /gsd-add-tests 12 focus on edge cases in the pricing module
```

退出。
</step>

<step name="init_context">
加载 phase 操作上下文：

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 提取：`phase_dir`, `phase_number`, `phase_name`。

确认 phase 目录存在。如果不存在：
```
ERROR: Phase directory not found for phase ${PHASE_ARG}
Ensure the phase exists in .planning/phases/
```
退出。

读取 phase 产物（按优先级顺序）：
1. `${phase_dir}/*-SUMMARY.md` — 已实现内容、变更文件
2. `${phase_dir}/CONTEXT.md` — 验收标准、决策
3. `${phase_dir}/*-VERIFICATION.md` — 用户已验证场景（如果做过 UAT）

如果不存在 SUMMARY.md：
```
ERROR: No SUMMARY.md found for phase ${PHASE_ARG}
This command works on completed phases. Run /gsd-execute-phase first.
```
退出。

展示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ADD TESTS — Phase ${phase_number}: ${phase_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="analyze_implementation">
从 SUMMARY.md 中提取该 phase 修改的文件列表（"Files Changed" 或等价小节）。

对每个文件，归类到以下三类之一：

| Category | Criteria | Test Type |
|----------|----------|-----------|
| **TDD** | 可写成 `expect(fn(input)).toBe(output)` 的纯函数 | Unit tests |
| **E2E** | 可通过浏览器自动化验证的 UI 行为 | Playwright/E2E tests |
| **Skip** | 没有实际测试价值或已被覆盖 | None |

**TDD 归类规则：**
- 业务逻辑：计算、定价、税则、校验
- 数据转换：映射、过滤、聚合、格式化
- 解析器：CSV、JSON、XML、自定义格式解析
- 校验器：输入校验、schema 校验、业务规则
- 状态机：状态切换、workflow 步骤
- Utilities：字符串处理、日期处理、数字格式化

**E2E 归类规则：**
- Keyboard shortcuts：按键绑定、修饰键、组合键序列
- Navigation：页面切换、routing、breadcrumbs、前进/后退
- Form interactions：提交、校验错误、字段 focus、autocomplete
- Selection：行选择、多选、shift-click 范围选择
- Drag and drop：重排、在容器间移动
- Modal dialogs：打开、关闭、确认、取消
- Data grids：排序、过滤、行内编辑、列宽调整

**Skip 归类规则：**
- UI layout/styling：CSS classes、视觉外观、responsive breakpoints
- Configuration：config files、environment variables、feature flags
- Glue code：dependency injection setup、middleware registration、routing tables
- Migrations：database migrations、schema changes
- Simple CRUD：无业务逻辑的基础 create/read/update/delete
- Type definitions：records、DTOs、interfaces，且不含逻辑

读取每个文件来验证归类。不要只根据文件名归类。
</step>

<step name="present_classification">
继续前，先向用户展示归类结果并确认：


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。

```
AskUserQuestion(
  header: "Test Classification",
  question: |
    ## Files classified for testing

    ### TDD (Unit Tests) — {N} files
    {list of files with brief reason}

    ### E2E (Browser Tests) — {M} files
    {list of files with brief reason}

    ### Skip — {K} files
    {list of files with brief reason}

    {if $EXTRA_INSTRUCTIONS: "Additional instructions: ${EXTRA_INSTRUCTIONS}"}

    How would you like to proceed?
  options:
    - "Approve and generate test plan"
    - "Adjust classification (I'll specify changes)"
    - "Cancel"
)
```

如果用户选择 "Adjust classification"：应用修改后重新展示。
如果用户选择 "Cancel"：优雅退出。
</step>

<step name="discover_test_structure">
生成 test plan 前，先识别项目现有的 test 结构：

```bash
# Find existing test directories
find . -type d -name "*test*" -o -name "*spec*" -o -name "*__tests__*" 2>/dev/null | head -20
# Find existing test files for convention matching
find . -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "*Tests.fs" -o -name "*Test.fs" \) 2>/dev/null | head -20
# Check for test runners
ls package.json *.sln 2>/dev/null || true
```

识别：
- Test 目录结构（unit tests 在哪里，E2E tests 在哪里）
- 命名约定（`.test.ts`, `.spec.ts`, `*Tests.fs` 等）
- Test runner 命令（如何跑 unit tests，如何跑 E2E tests）
- Test framework（xUnit、NUnit、Jest、Playwright 等）

如果 test 结构有歧义，询问用户：
```
AskUserQuestion(
  header: "Test Structure",
  question: "I found multiple test locations. Where should I create tests?",
  options: [list discovered locations]
)
```
</step>

<step name="generate_test_plan">
对每个已批准文件，创建详细的 test plan。

**对于 TDD 文件**，按 RED-GREEN-REFACTOR 规划 tests：
1. 识别文件中可测试的函数/方法
2. 对每个函数：列出输入场景、预期输出、边界情况
3. 注意：由于代码已存在，tests 可能一开始就通过，这没问题，但要确认它们测的是正确行为

**对于 E2E 文件**，按 RED-GREEN 关卡规划 tests：
1. 从 CONTEXT.md/VERIFICATION.md 识别用户场景
2. 对每个场景：描述用户操作、预期结果、断言
3. 注意：RED 关卡表示要确认功能坏掉时测试确实会失败

展示完整 test plan：

```
AskUserQuestion(
  header: "Test Plan",
  question: |
    ## Test Generation Plan

    ### Unit Tests ({N} tests across {M} files)
    {for each file: test file path, list of test cases}

    ### E2E Tests ({P} tests across {Q} files)
    {for each file: test file path, list of test scenarios}

    ### Test Commands
    - Unit: {discovered test command}
    - E2E: {discovered e2e command}

    Ready to generate?
  options:
    - "Generate all"
    - "Cherry-pick (I'll specify which)"
    - "Adjust plan"
)
```

如果是 "Cherry-pick"：询问用户要包含哪些 tests。
如果是 "Adjust plan"：应用修改后重新展示。
</step>

<step name="execute_tdd_generation">
对每个已批准的 TDD test：

1. **创建 test file**，遵循已识别的项目约定（目录、命名、imports）

2. **编写 test**，使用清晰的 arrange/act/assert 结构：
   ```
   // Arrange — set up inputs and expected outputs
   // Act — call the function under test
   // Assert — verify the output matches expectations
   ```

3. **运行 test**：
   ```bash
   {discovered test command}
   ```

4. **评估结果：**
   - **Test passes**：很好，说明实现满足测试。还要确认测试覆盖的是有意义的行为（而不只是能编译通过）。
   - **Test fails with assertion error**：这可能是测试发现的真实 bug。标记它：
     ```
     ⚠️ Potential bug found: {test name}
     Expected: {expected}
     Actual: {actual}
     File: {implementation file}
     ```
     **不要修实现**，这是 test-generation 命令，不是 fix 命令。只记录发现。
   - **Test fails with error (import, syntax, etc.)**：这是 test 自身的错误。修复 test 并重新运行。
</step>

<step name="execute_e2e_generation">
对每个已批准的 E2E test：

1. **检查是否已有 tests** 覆盖同一场景：
   ```bash
   grep -r "{scenario keyword}" {e2e test directory} 2>/dev/null || true
   ```
   如果已存在，则扩展而不是重复创建。

2. **创建 test file**，目标是 CONTEXT.md/VERIFICATION.md 中的用户场景

3. **运行 E2E test**：
   ```bash
   {discovered e2e command}
   ```

4. **评估结果：**
   - **GREEN (passes)**：记录成功
   - **RED (fails)**：判断是 test 问题还是真实应用 bug。对 bug 做标记：
     ```
     ⚠️ E2E failure: {test name}
     Scenario: {description}
     Error: {error message}
     ```
   - **Cannot run**：报告 blocker。**不要**标记为完成。
     ```
     🛑 E2E blocker: {reason tests cannot run}
     ```

**No-skip rule：** 如果 E2E tests 不能执行（缺依赖、环境问题等），报告 blocker 并将该 test 标记为未完成。未实际运行时绝不能标记成功。
</step>

<step name="summary_and_commit">
创建 test coverage 报告并展示给用户：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST GENERATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Results

| Category | Generated | Passing | Failing | Blocked |
|----------|-----------|---------|---------|---------|
| Unit     | {N}       | {n1}    | {n2}    | {n3}    |
| E2E      | {M}       | {m1}    | {m2}    | {m3}    |

## Files Created/Modified
{list of test files with paths}

## Coverage Gaps
{areas that couldn't be tested and why}

## Bugs Discovered
{any assertion failures that indicate implementation bugs}
```

在 project state 中记录 test generation：
```bash
gsd-sdk query state-snapshot
```

如果有通过的 tests 可提交：

```bash
git add {test files}
git commit -m "test(phase-${phase_number}): add unit and E2E tests from add-tests command"
```

展示后续步骤：

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

{if bugs discovered:}
**修复已发现 bug：** `/gsd-quick fix the {N} test failures discovered in phase ${phase_number}`

{if blocked tests:}
**解决 test blockers：** {description of what's needed}

{otherwise:}
**全部 tests 通过！** Phase ${phase_number} 已完成完整测试。

---

**也可继续：**
- `/gsd-add-tests {next_phase}` — 为另一个 phase 补 tests
- `/gsd-verify-work {phase_number}` — 运行 UAT 验证

---
```
</step>

</process>

<success_criteria>
- [ ] 已加载 phase 产物（SUMMARY.md、CONTEXT.md，和可选的 VERIFICATION.md）
- [ ] 所有变更文件均已归类到 TDD/E2E/Skip
- [ ] 归类结果已展示并获用户批准
- [ ] 已识别项目 test 结构（目录、约定、runner）
- [ ] Test plan 已展示并获用户批准
- [ ] 已按 arrange/act/assert 结构生成 TDD tests
- [ ] 已生成面向用户场景的 E2E tests
- [ ] 所有 tests 均已执行，未测试的 test 不得标记为 passing
- [ ] 由 tests 发现的 bugs 已标记（未修复）
- [ ] Test files 已用合适的 message 提交
- [ ] Coverage gaps 已记录
- [ ] 已向用户展示后续步骤
</success_criteria>
