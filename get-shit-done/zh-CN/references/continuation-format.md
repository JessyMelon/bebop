# 续接格式

完成某个命令或工作流后，用于展示下一步操作的标准格式。

## Core Structure

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**{identifier}: {name}** — {one-line description}

`/clear` then:

`{command to copy-paste}`

---

**Also available:**
- `{alternative option 1}` — description
- `{alternative option 2}` — description

---
```

> 如果 init context 中未设置 `project_code`，则省略项目标识后缀：
> `## ▶ Next Up`（不带 ` — [CODE] Title`）。

## Format Rules

1. **Always show what it is** — 一定展示名称 + 描述，不要只给一个命令路径
2. **Pull context from source** — phase 从 ROADMAP.md 取，plan 从 PLAN.md `<objective>` 取
3. **Command in inline code** — 用反引号，便于复制粘贴，并会渲染成可点击链接
4. **`/clear` first** — 始终先展示 `/clear` 再展示命令，确保用户按正确顺序执行
5. **"Also available" not "Other options"** — 听起来更像应用里的选项
6. **Visual separators** — 上下都用 `---`，让它明显突出
7. **Project identity in heading** — 在标题中包含 init context 里的 `[PROJECT_CODE] PROJECT_TITLE`，让跨会话交接时能自我标识。如果 `project_code` 未设置，就完全省略该后缀（只保留 `## ▶ Next Up`）

## Variants

### Execute Next Plan

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry

`/clear` then:

`/gsd-execute-phase 2`

---

**Also available:**
- Review plan before executing
- `/gsd-list-phase-assumptions 2` — check assumptions

---
```

### Execute Final Plan in Phase

添加说明，表明这是该阶段最后一个计划，以及接下来会发生什么：

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry
<sub>Final plan in Phase 2</sub>

`/clear` then:

`/gsd-execute-phase 2`

---

**After this completes:**
- Phase 2 → Phase 3 transition
- Next: **Phase 3: Core Features** — User dashboard and settings

---
```

### Plan a Phase

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase 2: Authentication** — JWT login flow with refresh tokens

`/clear` then:

`/gsd-plan-phase 2`

---

**Also available:**
- `/gsd-discuss-phase 2` — gather context first
- `/gsd-research-phase 2` — investigate unknowns
- Review roadmap

---
```

### Phase Complete, Ready for Next

在下一步操作前先展示完成状态：

```
---

## ✓ Phase 2 Complete

3/3 plans executed

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase 3: Core Features** — User dashboard, settings, and data export

`/clear` then:

`/gsd-plan-phase 3`

---

**Also available:**
- `/gsd-discuss-phase 3` — gather context first
- `/gsd-research-phase 3` — investigate unknowns
- Review what Phase 2 built

---
```

### Multiple Equal Options

当没有明确的主要动作时：

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase 3: Core Features** — User dashboard, settings, and data export

`/clear` then one of:

**To plan directly:** `/gsd-plan-phase 3`

**To discuss context first:** `/gsd-discuss-phase 3`

**To research unknowns:** `/gsd-research-phase 3`

---
```

### Milestone Complete

```
---

## 🎉 Milestone v1.0 Complete

All 4 phases shipped

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Start v1.1** — questioning → research → requirements → roadmap

`/clear` then:

`/gsd-new-milestone`

---
```

## Pulling Context

### For phases (from ROADMAP.md):

```markdown
### Phase 2: Authentication
**Goal**: JWT login flow with refresh tokens
```

提取为：`**Phase 2: Authentication** — JWT login flow with refresh tokens`

### For plans (from ROADMAP.md):

```markdown
Plans:
- [ ] 02-03: Add refresh token rotation
```

或从 PLAN.md `<objective>`：

```xml
<objective>
Add refresh token rotation with sliding expiry window.

Purpose: Extend session lifetime without compromising security.
</objective>
```

提取为：`**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry`

## Anti-Patterns

### Don't: Command-only (no context)

```
## To Continue

Run `/clear`, then paste:
/gsd-execute-phase 2
```

用户根本不知道 02-03 是什么内容。

### Don't: Missing /clear explanation

```
`/gsd-plan-phase 3`

Run /clear first.
```

没有解释原因。用户可能会跳过。

### Don't: "Other options" language

```
Other options:
- Review roadmap
```

听起来像附带说明。请改用 `Also available:`。

### Don't: Fenced code blocks for commands

```
```
/gsd-plan-phase 3
```
```

模板里的 fenced blocks 会造成嵌套歧义。命令应使用内联反引号。
