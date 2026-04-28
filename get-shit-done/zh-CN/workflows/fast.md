<purpose>
直接内联执行一个琐碎任务，不承担 subagent 开销。不写 PLAN.md，不启动 Task，
不做 research，也不检查 plan。就是：理解 → 执行 → commit → 记录。

适用于这类任务：修 typo、更新一个 config 值、补一个缺失 import、重命名
变量、提交未提交的工作、加一条 .gitignore、提升版本号。

任何需要多步规划或 research 的任务都用 /gsd-quick。
</purpose>

<process>

<step name="parse_task">
从 `$ARGUMENTS` 解析任务描述。

如果为空，则提问：
```
What's the quick fix? (one sentence)
```

存为 `$TASK`。
</step>

<step name="scope_check">
**开始之前，先确认这件事确实是琐碎任务。**

满足以下条件才算 trivial：
- ≤ 3 个文件编辑
- ≤ 1 分钟工作量
- 不引入新依赖，也不改架构
- 不需要 research

如果任务看起来并不 trivial（多文件重构、新功能、需要 research），
则输出：

```
This looks like it needs planning. Use /gsd-quick instead:
  /gsd-quick "{task description}"
```

然后停止。
</step>

<step name="execute_inline">
直接完成工作：

1. 读取相关文件
2. 修改内容
3. 验证修改有效（如适用则运行现有测试，否则做快速 sanity check）

**不要写 PLAN.md。** 直接做。
</step>

<step name="commit">
以原子方式提交变更：

```bash
git add -A
git commit -m "fix: {concise description of what changed}"
```

根据情况使用 conventional commit 格式：`fix:`, `feat:`, `docs:`, `chore:`, `refactor:`。
</step>

<step name="log_to_state">
如果存在 `.planning/STATE.md`，就追加到 "Quick Tasks Completed" 表中。
如果表不存在，则静默跳过。

```bash
# Check if STATE.md has quick tasks table
if grep -q "Quick Tasks Completed" .planning/STATE.md 2>/dev/null; then
  # Append entry — workflow handles the format
  echo "| $(date +%Y-%m-%d) | fast | $TASK | ✅ |" >> .planning/STATE.md
fi
```
</step>

<step name="done">
报告完成情况：

```
✅ Done: {what was changed}
   Commit: {short hash}
   Files: {list of changed files}
```

不要给下一步建议。不要做工作流路由。做完即止。
</step>

</process>

<guardrails>
- NEVER spawn a Task/subagent — this runs inline
- NEVER create PLAN.md or SUMMARY.md files
- NEVER run research or plan-checking
- If the task takes more than 3 file edits, STOP and redirect to /gsd-quick
- If you're unsure how to implement it, STOP and redirect to /gsd-quick
</guardrails>

<success_criteria>
- [ ] 已在当前上下文中完成任务（无 subagents）
- [ ] 已用规范消息完成原子 git commit
- [ ] 若存在 STATE.md，则已更新
- [ ] 总操作墙钟时间低于 2 分钟
</success_criteria>
