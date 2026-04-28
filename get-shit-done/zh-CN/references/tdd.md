<overview>
TDD 的重点是设计质量，不是覆盖率指标。红-绿-重构循环会迫使你在实现前先思考行为，从而产出更干净的接口和更易测试的代码。

**原则：** 如果你能在写 `fn` 之前先写出 `expect(fn(input)).toBe(output)` 来描述行为，那么 TDD 会带来更好的结果。

**关键点：** TDD 工作本质上比标准任务更重，它需要 2-3 个执行循环（RED → GREEN → REFACTOR），每个循环都包含文件读取、测试运行，以及可能的调试。TDD 功能会获得专门的计划，以确保整个循环中始终具备完整上下文。
</overview>

<when_to_use_tdd>
## 何时 TDD 能提升质量

**适合 TDD 的场景（创建 TDD plan）：**
- 具有明确输入/输出的业务逻辑
- 具有请求/响应契约的 API endpoint
- 数据转换、解析、格式化
- 校验规则和约束
- 具有可测试行为的算法
- 状态机和工作流
- 规格清晰的工具函数

**跳过 TDD（使用带 `type="auto"` 任务的标准 plan）：**
- UI 布局、样式、视觉组件
- 配置变更
- 连接现有组件的胶水代码
- 一次性脚本和迁移
- 没有业务逻辑的简单 CRUD
- 探索性原型

**经验判断：** 你能在写 `fn` 之前先写出 `expect(fn(input)).toBe(output)` 吗？
→ 可以：创建 TDD plan
→ 不可以：使用标准 plan，需要时事后补测试
</when_to_use_tdd>

<tdd_plan_structure>
## TDD 计划结构

每个 TDD plan 都通过完整的 RED-GREEN-REFACTOR 循环实现**一个功能**。

```markdown
---
phase: XX-name
plan: NN
type: tdd
---

<objective>
[实现什么功能，以及原因]
Purpose: [TDD 为该功能带来的设计收益]
Output: [可工作、已测试的功能]
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@relevant/source/files.ts
</context>

<feature>
  <name>[功能名]</name>
  <files>[source file, test file]</files>
  <behavior>
    [用可测试术语描述的预期行为]
    Cases: input → expected output
  </behavior>
  <implementation>[测试通过后如何实现]</implementation>
</feature>

<verification>
[证明功能可用的测试命令]
</verification>

<success_criteria>
- 已写出并提交失败测试
- 实现通过测试
- 已完成重构（如需要）
- 存在完整的 2-3 个提交
</success_criteria>

<output>
完成后，创建 SUMMARY.md，包含：
- RED: 写了什么测试，为什么失败
- GREEN: 什么实现使其通过
- REFACTOR: 做了什么清理（如有）
- Commits: 产出的提交列表
</output>
```

**每个 TDD plan 只做一个功能。** 如果多个功能已经简单到可以打包处理，那也简单到不必做 TDD，直接使用标准 plan 并在事后补测试。
</tdd_plan_structure>

<execution_flow>
## 红-绿-重构循环

**RED - 写失败测试：**
1. 按项目约定创建测试文件
2. 写出描述预期行为的测试（来自 `<behavior>` 元素）
3. 运行测试，它**必须失败**
4. 如果测试通过：说明功能已存在，或测试写错了。先调查。
5. 提交：`test({phase}-{plan}): add failing test for [feature]`

**GREEN - 实现以通过测试：**
1. 写最少代码让测试通过
2. 不耍聪明，不做优化，只要能工作
3. 运行测试，它**必须通过**
4. 提交：`feat({phase}-{plan}): implement [feature]`

**REFACTOR（如需要）：**
1. 如果存在明显改进，则清理实现
2. 运行测试，**必须仍然通过**
3. 仅在确有修改时提交：`refactor({phase}-{plan}): clean up [feature]`

**结果：** 每个 TDD plan 会产生 2-3 个原子提交。
</execution_flow>

<test_quality>
## 好测试与坏测试

**测试行为，不测实现：**
- Good: "返回格式化后的日期字符串"
- Bad: "以正确参数调用 formatDate helper"
- 测试应能经受重构

**每个测试只关注一个概念：**
- Good: 分别为有效输入、空输入、格式错误输入编写独立测试
- Bad: 用一个测试和多个断言检查所有边界情况

**命名要有描述性：**
- Good: "应拒绝空 email"，"无效 ID 时返回 null"
- Bad: "test1"，"处理错误"，"工作正常"

**不要包含实现细节：**
- Good: 测试公共 API、可观察行为
- Bad: mock 内部实现、测试私有方法、断言内部状态
</test_quality>

<framework_setup>
## 测试框架设置（如果尚不存在）

执行 TDD plan 时如果尚未配置测试框架，应把这一步纳入 RED 阶段：

**1. 检测项目类型：**
```bash
# JavaScript/TypeScript
if [ -f package.json ]; then echo "node"; fi

# Python
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then echo "python"; fi

# Go
if [ -f go.mod ]; then echo "go"; fi

# Rust
if [ -f Cargo.toml ]; then echo "rust"; fi
```

**2. 安装最小框架：**
| Project | Framework | Install |
|---------|-----------|---------|
| Node.js | Jest | `npm install -D jest @types/jest ts-jest` |
| Node.js (Vite) | Vitest | `npm install -D vitest` |
| Python | pytest | `pip install pytest` |
| Go | testing | 内建 |
| Rust | cargo test | 内建 |

**3. 需要时创建配置：**
- Jest: 使用带 ts-jest preset 的 `jest.config.js`
- Vitest: 使用带 test globals 的 `vitest.config.ts`
- pytest: `pytest.ini` 或 `pyproject.toml` 中的 section

**4. 验证配置：**
```bash
# 运行空测试套件，应以 0 个测试通过
npm test  # Node
pytest    # Python
go test ./...  # Go
cargo test    # Rust
```

**5. 创建第一个测试文件：**
按项目约定放置测试文件：
- `*.test.ts` / `*.spec.ts` 与源码同目录
- `__tests__/` 目录
- 根目录下的 `tests/` 目录

框架配置是一次性成本，计入首个 TDD plan 的 RED 阶段。
</framework_setup>

<error_handling>
## 错误处理

**RED 阶段测试没有失败：**
- 功能可能已经存在，先调查
- 测试可能写错了（测的不是你以为的内容）
- 修好后再继续

**GREEN 阶段测试没有通过：**
- 调试实现
- 不要跳到重构
- 持续迭代，直到变绿

**REFACTOR 阶段测试失败：**
- 撤销重构
- 说明提交过早
- 用更小的步骤重构

**无关测试被破坏：**
- 停下来调查
- 可能说明存在耦合问题
- 修好后再继续
</error_handling>

<commit_pattern>
## TDD 计划的提交模式

TDD plan 会产生 2-3 个原子提交（每个阶段一个）：

```
test(08-02): add failing test for email validation

- Tests valid email formats accepted
- Tests invalid formats rejected
- Tests empty input handling

feat(08-02): implement email validation

- Regex pattern matches RFC 5322
- Returns boolean for validity
- Handles edge cases (empty, null)

refactor(08-02): extract regex to constant (optional)

- Moved pattern to EMAIL_REGEX constant
- No behavior changes
- Tests still pass
```

**与标准 plan 的对比：**
- 标准 plan：每个任务 1 个提交，每个 plan 2-4 个提交
- TDD plan：单个功能 2-3 个提交

两者都遵循相同格式：`{type}({phase}-{plan}): {description}`

**收益：**
- 每个提交都可独立回滚
- Git bisect 可在提交级别工作
- 清晰历史可展示 TDD 纪律
- 与整体提交策略一致
</commit_pattern>

<gate_enforcement>
## 关卡强制规则

当配置中启用 `workflow.tdd_mode` 时，会对所有 `type: tdd` plan 强制执行 RED/GREEN/REFACTOR 关卡顺序。

### 关卡定义

| 关卡 | 必需 | 提交模式 | 验证 |
|------|----------|---------------|------------|
| RED | 是 | `test({phase}-{plan}): ...` | 测试存在，并且在实现前失败 |
| GREEN | 是 | `feat({phase}-{plan}): ...` | 实现后测试通过 |
| REFACTOR | 否 | `refactor({phase}-{plan}): ...` | 清理后测试仍通过 |

### 快速失败规则

1. **RED 阶段意外变绿：** 如果在写任何实现代码之前测试就通过，立即停止。功能可能已存在，或测试写错了。先调查再继续。
2. **缺少 RED 提交：** 如果 `feat(...)` 提交之前没有 `test(...)` 提交，说明违反了 TDD 纪律。要在 SUMMARY.md 中标记。
3. **REFACTOR 破坏测试：** 立即撤销重构。说明提交过早，应以更小步伐重构。

### 执行器关卡验证

完成 `type: tdd` plan 后，执行器会校验 git log：
```bash
# Check for RED gate commit
git log --oneline --grep="^test(${PHASE}-${PLAN})" | head -1
# Check for GREEN gate commit  
git log --oneline --grep="^feat(${PHASE}-${PLAN})" | head -1
# Check for optional REFACTOR gate commit
git log --oneline --grep="^refactor(${PHASE}-${PLAN})" | head -1
```

如果缺少 RED 或 GREEN 关卡提交，就在 SUMMARY.md 中添加 `## TDD Gate Compliance` 小节并写明违规细节。
</gate_enforcement>

<end_of_phase_review>
## 阶段结束 TDD 评审检查点

启用 `workflow.tdd_mode` 时，execute-phase 编排器会在所有 wave 完成后、phase 验证前插入一个协作式评审检查点。

### 评审检查点格式

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TDD REVIEW — Phase {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TDD Plans: {count} | Gate violations: {count}

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| {id} |  ✓  |   ✓   |    ✓     | Pass   |
| {id} |  ✓  |   ✗   |    —     | FAIL   |

{If violations exist:}
⚠ Gate violations are advisory — review before advancing.
```

### 评审会检查什么

1. **关卡顺序：** 每个 TDD plan 都按顺序具有 RED → GREEN 提交
2. **测试质量：** RED 阶段测试因正确原因失败，而不是 import 错误或语法错误
3. **最小化 GREEN：** 实现保持最小化，GREEN 阶段没有过早优化
4. **重构纪律：** 如果存在 REFACTOR 提交，测试仍然通过

这个检查点是建议性的，不会阻止 phase 完成，但会把 TDD 纪律问题暴露给人工评审。
</end_of_phase_review>

<context_budget>
## 上下文预算

TDD plan 的目标是**约 40% 的上下文使用量**（低于标准 plan 约 50% 的目标）。

之所以更低：
- RED 阶段：写测试、跑测试，并可能调试为什么它没有失败
- GREEN 阶段：实现、跑测试，并可能反复处理失败
- REFACTOR 阶段：修改代码、跑测试、验证无回归

每个阶段都要读文件、跑命令、分析输出。这种来回切换天然比线性任务执行更重。

聚焦单一功能，才能在整个循环中保持完整质量。
</context_budget>
