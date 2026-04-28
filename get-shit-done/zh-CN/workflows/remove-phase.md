<purpose>
从项目 roadmap 中移除一个尚未开始的未来 phase，删除其目录，并为之后的所有 phase 重新编号，以保持清晰的线性顺序，然后提交这次变更。git commit 作为移除操作的历史记录。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<process>

<step name="parse_arguments">
解析命令参数：
- 参数是要移除的 phase 编号（整数或小数）
- 示例：`/gsd-remove-phase 17` → phase = 17
- 示例：`/gsd-remove-phase 16.1` → phase = 16.1

如果未提供参数：

```
ERROR: 需要提供 phase 编号
用法: /gsd-remove-phase <phase-number>
示例: /gsd-remove-phase 17
```

退出。
</step>

<step name="init_context">
加载 phase 操作上下文：

```bash
INIT=$(gsd-sdk query init.phase-op "${target}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

提取：`phase_found`, `phase_dir`, `phase_number`, `commit_docs`, `roadmap_exists`。

另外读取 STATE.md 和 ROADMAP.md 的内容，用于解析当前位置。
</step>

<step name="validate_future_phase">
验证该 phase 是否为未来 phase（尚未开始）：

1. 将目标 phase 与 STATE.md 中的当前 phase 比较
2. 目标必须 > 当前 phase 编号

如果 target <= current phase：

```
ERROR: 无法移除 Phase {target}

只能移除未来的 phases：
- 当前 phase: {current}
- Phase {target} 是当前 phase 或已完成

如果要放弃当前工作，请改用 /gsd-pause-work。
```

退出。
</step>

<step name="confirm_removal">
展示移除摘要并确认：

```
正在移除 Phase {target}: {Name}

这将会：
- 删除: .planning/phases/{target}-{slug}/
- 为之后所有 phase 重新编号
- 更新: ROADMAP.md, STATE.md

是否继续？(y/n)
```

等待确认。
</step>

<step name="execute_removal">
**将整个移除操作委托给 `gsd-sdk query phase.remove`：**

```bash
RESULT=$(gsd-sdk query phase.remove "${target}")
```

如果该 phase 有已执行的 plan（存在 SUMMARY.md 文件），CLI 会报错。只有在用户确认时才使用 `--force`：

```bash
RESULT=$(gsd-sdk query phase.remove "${target}" --force)
```

CLI 会处理：
- 删除 phase 目录
- 为之后的所有目录重新编号（按逆序处理以避免冲突）
- 重命名重新编号目录中的所有文件（PLAN.md、SUMMARY.md 等）
- 更新 ROADMAP.md（移除对应 section、为所有 phase 引用重新编号、更新依赖关系）
- 更新 STATE.md（将 phase 总数减 1）

从结果中提取：`removed`, `directory_deleted`, `renamed_directories`, `renamed_files`, `roadmap_updated`, `state_updated`。
</step>

<step name="commit">
暂存并提交这次移除：

```bash
gsd-sdk query commit "chore: remove phase {target} ({original-phase-name})" .planning/
```

该 commit message 用于保留被移除内容的历史记录。
</step>

<step name="completion">
展示完成摘要：

```
Phase {target} ({original-name}) 已移除。

变更：
- 已删除: .planning/phases/{target}-{slug}/
- 已重新编号: {N} 个目录和 {M} 个文件
- 已更新: ROADMAP.md, STATE.md
- 已提交: chore: remove phase {target} ({original-name})

---

## 下一步

你想要：
- `/gsd-progress` — 查看更新后的 roadmap 状态
- 继续当前 phase
- 查看 roadmap

---
```
</step>

</process>

<anti_patterns>

- 不要在没有 --force 的情况下移除已完成的 phases（有 SUMMARY.md 文件）
- 不要移除当前或过去的 phases
- 不要手动重新编号，使用 `gsd-sdk query phase.remove`，它会处理全部重新编号工作
- 不要在 STATE.md 中添加“removed phase”备注，git commit 就是记录
- 不要修改已完成的 phase 目录
</anti_patterns>

<success_criteria>
在以下条件满足时，phase 移除完成：

- [ ] 已验证目标 phase 是未来/未开始 phase
- [ ] `gsd-sdk query phase.remove` 已成功执行
- [ ] 变更已用清晰的消息提交
- [ ] 用户已获知变更内容
</success_criteria>
