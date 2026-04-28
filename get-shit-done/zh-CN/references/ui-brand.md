<ui_patterns>

面向用户的 GSD 输出视觉模式。编排器会用 @ 引用这个文件。

## 阶段横幅

用于主要工作流切换。

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► {STAGE NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**阶段名称（大写）：**
- `QUESTIONING`
- `RESEARCHING`
- `DEFINING REQUIREMENTS`
- `CREATING ROADMAP`
- `PLANNING PHASE {N}`
- `EXECUTING WAVE {N}`
- `VERIFYING`
- `PHASE {N} COMPLETE ✓`
- `MILESTONE COMPLETE 🎉`

---

## 检查点框

需要用户操作。宽度为 62 个字符。

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: {Type}                                          ║
╚══════════════════════════════════════════════════════════════╝

{Content}

──────────────────────────────────────────────────────────────
→ {ACTION PROMPT}
──────────────────────────────────────────────────────────────
```

**类型：**
- `CHECKPOINT: Verification Required` → `→ Type "approved" or describe issues`
- `CHECKPOINT: Decision Required` → `→ Select: option-a / option-b`
- `CHECKPOINT: Action Required` → `→ Type "done" when complete`

---

## 状态符号

```
✓  完成 / 通过 / 已验证
✗  失败 / 缺失 / 被阻塞
◆  进行中
○  待处理
⚡ Auto-approved
⚠  警告
🎉 Milestone complete (only in banner)
```

---

## 进度展示

**阶段/milestone 级别：**
```
Progress: ████████░░ 80%
```

**任务级别：**
```
Tasks: 2/4 complete
```

**计划级别：**
```
Plans: 3/5 complete
```

---

## 启动提示

```
◆ Spawning researcher...

◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research

✓ Researcher complete: STACK.md written
```

---

## 下一步区块

始终放在重大完成节点的末尾。

```
───────────────────────────────────────────────────────────────

## ▶ 下一步

**{Identifier}: {Name}** — {单行描述}

先执行 `/clear`，然后：

{copy-paste command}

───────────────────────────────────────────────────────────────

**也可使用：**
- `/gsd-alternative-1` — 说明
- `/gsd-alternative-2` — 说明

───────────────────────────────────────────────────────────────
```

---

## 错误框

```
╔══════════════════════════════════════════════════════════════╗
║  ERROR                                                       ║
╚══════════════════════════════════════════════════════════════╝

{错误描述}

**修复方式：** {解决步骤}
```

---

## 表格

```
| Phase | Status | Plans | Progress |
|-------|--------|-------|----------|
| 1     | ✓      | 3/3   | 100%     |
| 2     | ◆      | 1/4   | 25%      |
| 3     | ○      | 0/2   | 0%       |
```

---

## 反模式

- 不同的 box/banner 宽度不一致
- 混用 banner 样式（`===`、`---`、`***`）
- banner 中省略 `GSD ►` 前缀
- 随机使用 emoji（`🚀`、`✨`、`💫`）
- 完成后缺少 Next Up block

</ui_patterns>
