<purpose>
安全的 git revert workflow。借助 phase manifest 并结合依赖检查与确认关卡，回滚 GSD phase 或 plan commit。使用 git revert --no-commit（绝不使用 git reset）来保留历史。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
</required_reading>

<process>

<step name="banner" priority="first">
显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UNDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="parse_arguments">
从 $ARGUMENTS 解析 undo mode：

- `--last N` → MODE=last, COUNT=N（整数；如果缺少 N，默认 10）
- `--phase NN` → MODE=phase, TARGET_PHASE=NN（两位 phase number）
- `--plan NN-MM` → MODE=plan, TARGET_PLAN=NN-MM（phase-plan ID）

如果没有提供有效参数，显示用法并退出：

```
用法: /gsd-undo --last N | --phase NN | --plan NN-MM

模式:
  --last N      显示最近 N 个 GSD commits 供交互选择
  --phase NN    回滚 phase NN 的全部 commits
  --plan NN-MM  回滚 plan NN-MM 的全部 commits

示例:
  /gsd-undo --last 5
  /gsd-undo --phase 03
  /gsd-undo --plan 03-02
```
</step>

<step name="gather_commits">
根据 MODE 收集候选 commits。

**MODE=last：**

运行：
```bash
git log --oneline --no-merges -${COUNT}
```

筛选符合 `type(scope): message` 模式的 GSD conventional commits（例如 `feat(04-01):`、`docs(03):`、`fix(02-03):`）。

显示匹配 commit 的编号列表：
```
最近的 GSD commits:
  1. abc1234 feat(04-01): implement auth endpoint
  2. def5678 docs(03-02): complete plan summary
  3. ghi9012 fix(02-03): correct validation logic
```


**文本模式（配置中 `workflow.text_mode: true` 或传入 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，把每次 `AskUserQuestion` 调用改为纯文本编号列表，并让用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）在没有 `AskUserQuestion` 时的必需行为。
使用 AskUserQuestion 提问：
- question: "要回滚哪些 commits？输入编号（如 1,3）或 'all'"
- header: "选择"

把用户选择解析为 COMMITS 列表。

---

**MODE=phase：**

读取 `.planning/.phase-manifest.json`（如果存在）。

如果文件存在，且 `manifest.phases?.[TARGET_PHASE]?.commits` 是非空数组：
  - 使用 `manifest.phases[TARGET_PHASE].commits` 中的条目作为 COMMITS（每项都是 commit hash）

如果文件不存在，或 `manifest.phases?.[TARGET_PHASE]` 缺失：
  - 显示："Manifest 中没有 phase ${TARGET_PHASE} 的条目（或文件缺失），回退到 git log 搜索"
  - 回退：运行 git log 并按目标 phase scope 过滤：
    ```bash
    git log --oneline --no-merges --all | grep -E "\(0*${TARGET_PHASE}(-[0-9]+)?\):" | head -50
    ```
  - 使用匹配的 commits 作为 COMMITS

---

**MODE=plan：**

运行：
```bash
git log --oneline --no-merges --all | grep -E "\(${TARGET_PLAN}\)" | head -50
```

使用匹配的 commits 作为 COMMITS。

---

**空结果检查：**

如果收集后 COMMITS 为空：
```
未找到 ${MODE} ${TARGET} 对应的 commits。无需回滚。
```
正常退出。
</step>

<step name="dependency_check">
**仅在 MODE=phase 或 MODE=plan 时适用。**

MODE=last 时完全跳过此步骤。

---

**MODE=phase：**

内联读取 `.planning/ROADMAP.md`。

搜索依赖目标 phase 的其他 phases。查找类似模式：
- "Depends on: Phase ${TARGET_PHASE}"
- "Depends on: ${TARGET_PHASE}"
- "depends_on: [${TARGET_PHASE}]"

对找到的每个依赖 phase N：
1. 检查 `.planning/phases/${N}-*/` 目录是否存在
2. 如果目录存在，检查其中是否有任何 PLAN.md 或 SUMMARY.md 文件

如果任一下游 phase 已开始工作，收集警告：
```
⚠  检测到下游依赖：
   Phase ${N} 依赖 Phase ${TARGET_PHASE}，并且已经开始工作。
```

---

**MODE=plan：**

从 TARGET_PLAN 中提取 phase number（NN-MM 中的 NN）和 plan number（MM）。

在同一 phase 目录（`.planning/phases/${NN}-*/`）中查找更晚的 plans。对每个更晚的 plan（plan number > MM）：
1. 读取该后续 plan 的 PLAN.md
2. 检查它的 `<files>` section 或 `consumes` field 是否引用目标 plan 的输出

如果后续 plan 引用了目标 plan 的输出，收集警告：
```
⚠  检测到 phase 内依赖：
   Phase ${NN} 中的 Plan ${LATER_PLAN} 引用了 Plan ${TARGET_PLAN} 的输出。
```

---

如果存在任何警告（任一 mode）：
- 显示全部警告
- 使用 AskUserQuestion，并采用 approve-revise-abort pattern：
  - question: "下游工作依赖于即将回滚的目标。仍要继续吗？"
  - header: "确认"
  - options: Proceed | Abort

如果用户选择 "Abort"：退出并提示 "Revert cancelled. No changes made."
</step>

<step name="confirm_revert">
使用 gate-prompts.md 中的 approve-revise-abort pattern 显示确认关卡。

显示：
```
以下 commits 将被回滚（按时间倒序）：

  {hash} — {message}
  {hash} — {message}
  ...

总计：{N} 个 commit 待回滚
```

使用 AskUserQuestion：
- question: "确认执行 revert 吗？"
- header: "Approve?"
- options: Approve | Abort

如果选 "Abort"：显示 "Revert cancelled. No changes made." 并退出。
如果选 "Approve"：询问原因：

```
AskUserQuestion(
  header: "Reason",
  question: "Brief reason for the revert (used in commit message):",
  options: []
)
```

把响应保存为 REVERT_REASON。继续 execute_revert。
</step>

<step name="execute_revert">
**硬性约束：使用 git revert --no-commit。绝不要使用 git reset（除下文记录的冲突清理场景外）。**

**脏工作树保护（第一步，在任何 revert 之前执行）：**

运行 `git status --porcelain`。如果输出非空，显示脏文件并中止：
```
工作树存在未提交变更。请先 commit 或 stash，再运行 /gsd-undo。
```
立即退出，不要继续任何 revert 操作。

---

将 COMMITS 按时间倒序排序（最新优先）。如果 commits 来自 git log（本身已是最新优先），顺序已经正确。

对 COMMITS 中的每个 commit hash：
```bash
git revert --no-commit ${HASH}
```

如果任一 revert 失败（merge conflict 或其他错误）：
1. 显示错误信息
2. 运行清理，同时覆盖首个调用失败和中途失败两种情况：
   ```bash
   # 先尝试 git revert --abort（如果这是第一次失败的 revert，会生效）
   git revert --abort 2>/dev/null
   # 如果此前已有 --no-commit revert 已干净地 staged，
   # revert --abort 可能不会做任何事。此时清理 staged 和 working tree 变更：
   git reset HEAD 2>/dev/null
   git restore . 2>/dev/null
   ```
3. 显示：
   ```
   ╔══════════════════════════════════════════════════════════════╗
   ║  ERROR                                                       ║
   ╚══════════════════════════════════════════════════════════════╝

   Revert failed on commit ${HASH}.
   Likely cause: merge conflict with subsequent changes.

   **To fix:** Resolve the conflict manually or revert commits individually.
   All pending reverts have been aborted — working tree is clean.
   ```
4. 带错误退出。

全部 revert 都成功 staged 后，创建一个单独的 commit：

对于 MODE=phase：
```bash
git commit -m "revert(${TARGET_PHASE}): undo phase ${TARGET_PHASE} — ${REVERT_REASON}"
```

对于 MODE=plan：
```bash
git commit -m "revert(${TARGET_PLAN}): undo plan ${TARGET_PLAN} — ${REVERT_REASON}"
```

对于 MODE=last：
```bash
git commit -m "revert: undo ${N} selected commits — ${REVERT_REASON}"
```
</step>

<step name="summary">
显示完成横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UNDO COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

显示摘要：
```
  ✓ ${N} commit(s) reverted
  ✓ Single revert commit created: ${REVERT_HASH}
```

显示下一步：
```
───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**检查当前状态** — 确认回滚后项目处于预期状态

/clear then:

/gsd-progress

───────────────────────────────────────────────────────────────

**还可使用：**
- `/gsd-execute-phase ${PHASE}` — 如有需要，重新执行
- `/gsd-undo --last 1` — 如果有问题，回滚这次 revert 本身

───────────────────────────────────────────────────────────────
```
</step>

</process>

<success_criteria>
- [ ] 三种 mode 的参数都能正确解析
- [ ] `--phase` mode 会通过 manifest.phases[TARGET_PHASE].commits 读取 .planning/.phase-manifest.json
- [ ] `--phase` mode 在 manifest 条目缺失时会回退到 git log
- [ ] 当下游 phases 已开始时，依赖检查会给出警告（MODE=phase）
- [ ] 当后续 plans 引用目标 plan 输出时，依赖检查会给出警告（MODE=plan）
- [ ] 脏工作树保护会在存在未提交变更时中止
- [ ] 在执行任何 revert 前都会显示确认关卡
- [ ] revert 按时间倒序使用 git revert --no-commit
- [ ] 所有 revert staged 后会创建单个 commit
- [ ] 错误处理能清理首个调用冲突和中途冲突两种情况
- [ ] 本 workflow 中绝不使用 git reset --hard
</success_criteria>
