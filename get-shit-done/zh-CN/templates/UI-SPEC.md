---
phase: {N}
slug: {phase-slug}
status: draft
shadcn_initialized: false
preset: none
created: {date}
---

# Phase {N} — UI 设计契约

> 前端阶段的视觉与交互契约。由 gsd-ui-researcher 生成，由 gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | {shadcn / none} |
| Preset | {preset string or "not applicable"} |
| Component library | {radix / base-ui / none} |
| Icon library | {library} |
| Font | {font} |

---

## Spacing Scale

已声明的值（必须都是 4 的倍数）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 图标间距、行内内边距 |
| sm | 8px | 紧凑元素间距 |
| md | 16px | 默认元素间距 |
| lg | 24px | 区块内边距 |
| xl | 32px | 布局间距 |
| 2xl | 48px | 大区块分隔 |
| 3xl | 64px | 页面级间距 |

Exceptions: {list any, or "none"}

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | {px} | {weight} | {ratio} |
| Label | {px} | {weight} | {ratio} |
| Heading | {px} | {weight} | {ratio} |
| Display | {px} | {weight} | {ratio} |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | {hex} | 背景、表面 |
| Secondary (30%) | {hex} | 卡片、侧边栏、导航 |
| Accent (10%) | {hex} | {list specific elements only} |
| Destructive | {hex} | 仅用于破坏性操作 |

Accent 仅保留给：{explicit list — never "all interactive elements"}

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | {specific verb + noun} |
| Empty state heading | {copy} |
| Empty state body | {copy + next step} |
| Error state | {problem + solution path} |
| Destructive confirmation | {action name}: {confirmation copy} |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | {list} | not required |
| {third-party name} | {list} | shadcn view + diff required |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** {pending / approved YYYY-MM-DD}
