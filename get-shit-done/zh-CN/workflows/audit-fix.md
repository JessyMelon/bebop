<purpose>
自治式 audit-to-fix pipeline。运行 audit、解析 findings、将每项归类为
auto-fixable 或 manual-only，为可修复问题启动 executor agents，在每次修复后运行 tests，
并以包含 finding ID 的原子提交保证可追踪性。
</purpose>

<available_agent_types>
- gsd-executor — 执行一个具体且范围明确的代码修改
</available_agent_types>

<process>

<step name="parse-arguments">
从用户调用中提取 flags：

- `--max N` — 最多修复多少条 findings（默认：**5**）
- `--severity high|medium|all` — 处理的最低严重级别（默认：**medium**）
- `--dry-run` — 只分类 findings，不修复（仅展示分类表）
- `--source <audit>` — 要运行的 audit（默认：**audit-uat**）

校验 `--source` 是否为受支持的 audit。目前支持：
- `audit-uat`

如果 `--source` 不受支持，报错并停止：
```
Error: Unsupported audit source "{source}". Supported sources: audit-uat
```
</step>

<step name="run-audit">
调用 source audit 命令并捕获输出。

对于 `audit-uat` source：
```bash
INIT=$(gsd-sdk query audit-uat 2>/dev/null || echo "{}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

读取现有 UAT 和 verification files，提取 findings：
- Glob: `.planning/phases/*/*-UAT.md`
- Glob: `.planning/phases/*/*-VERIFICATION.md`

把每条 finding 解析为结构化记录：
- **ID** — 顺序标识符（F-01、F-02、...）
- **description** — 问题的简明摘要
- **severity** — high、medium 或 low
- **file_refs** — 该 finding 引用的具体文件路径
</step>

<step name="classify-findings">
对每条 finding，归类为以下之一：

- **auto-fixable** — 代码修改明确、引用了具体文件、修复可测试
- **manual-only** — 需要设计决策、范围含糊、涉及架构变化、需要用户输入
- **skip** — 严重级别低于 `--severity` 阈值

**分类启发式**（不确定时偏向 manual-only）：

Auto-fixable 信号：
- 引用了具体文件路径 + 行号
- 描述的是缺失 test 或断言
- 缺失 export、错误 import path、identifier typo
- 明确的单文件修改，预期行为显而易见

Manual-only 信号：
- 使用了 "consider"、"evaluate"、"design"、"rethink" 等词
- 需要新架构或 API 变更
- 范围含糊，存在多种合理做法
- 需要用户输入或设计决策
- 影响多个子系统的横切关注点
- 没有明确修法的性能或可扩展性问题

**只要不确定，一律归类为 manual-only。**
</step>

<step name="present-classification">
展示分类表：

```
## Audit-Fix Classification

| # | Finding | Severity | Classification | Reason |
|---|---------|----------|---------------|--------|
| F-01 | Missing export in index.ts | high | auto-fixable | Specific file, clear fix |
| F-02 | No error handling in payment flow | high | manual-only | Requires design decisions |
| F-03 | Test stub with 0 assertions | medium | auto-fixable | Clear test gap |
```

如果指定了 `--dry-run`，**到此为止并退出**。分类表就是最终输出，不再继续修复。
</step>

<step name="fix-loop">
对每个 **auto-fixable** finding（最多 `--max` 个，按严重级别降序）：

**a. 启动 executor agent：**
```
Task(
  prompt="Fix finding {ID}: {description}. Files: {file_refs}. Make the minimal change to resolve this specific finding. Do not refactor surrounding code.",
  subagent_type="gsd-executor"
)
```

**b. 运行 tests：**
```bash
AUDIT_TEST_CMD=$(gsd-sdk query config-get workflow.test_command --default "" 2>/dev/null || true)
if [ -z "$AUDIT_TEST_CMD" ]; then
  if [ -f "Makefile" ] && grep -q "^test:" Makefile; then
    AUDIT_TEST_CMD="make test"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then
    AUDIT_TEST_CMD="just test"
  elif [ -f "package.json" ]; then
    AUDIT_TEST_CMD="npm test"
  elif [ -f "Cargo.toml" ]; then
    AUDIT_TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then
    AUDIT_TEST_CMD="go test ./..."
  elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
    AUDIT_TEST_CMD="python -m pytest -x -q --tb=short"
  else
    AUDIT_TEST_CMD="true"
  fi
fi
eval "$AUDIT_TEST_CMD" 2>&1 | tail -20
```

**c. 如果 tests 通过** — 原子提交：
```bash
git add {changed_files}
git commit -m "fix({scope}): resolve {ID} — {description}"
```
Commit message **必须**包含 finding ID（例如 F-01），以便追踪。

**d. 如果 tests 失败** — 回滚变更，将 finding 标记为 `fix-failed`，并且**停止整个 pipeline**：
```bash
git checkout -- {changed_files} 2>/dev/null
```

记录失败原因并停止处理，不要继续后续 finding。
Test 失败意味着代码库可能处于异常状态，因此 pipeline
必须停下，避免级联问题。剩余的 auto-fixable findings 会在
报告中标记为 `not-attempted`。
</step>

<step name="report">
展示最终摘要：

```
## Audit-Fix Complete

**Source:** {audit_command}
**Findings:** {total} total, {auto} auto-fixable, {manual} manual-only
**Fixed:** {fixed_count}/{auto} auto-fixable findings
**Failed:** {failed_count} (reverted)

| # | Finding | Status | Commit |
|---|---------|--------|--------|
| F-01 | Missing export | Fixed | abc1234 |
| F-03 | Test stub | Fix failed | (reverted) |

### Manual-only findings (require developer attention):
- F-02: No error handling in payment flow — requires design decisions
```
</step>

</process>

<success_criteria>
- Auto-fixable findings 按顺序处理，直到达到 --max 或 test 失败为止
- 每个已提交修复后 tests 都通过（没有 broken commit）
- 失败修复会被干净回滚（不留下部分变更）
- Pipeline 在首次 test 失败后停止（避免级联修复）
- 每条 commit message 都包含 finding ID
- Manual-only findings 已暴露给开发者处理
- --dry-run 会产出有用的独立分类表
</success_criteria>
