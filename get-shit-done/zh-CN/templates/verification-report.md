# 验证报告模板

用于 `.planning/phases/XX-name/{phase_num}-VERIFICATION.md` 的模板 —— 阶段目标验证结果。

---

## 文件模板

```markdown
---
phase: XX-name
verified: YYYY-MM-DDTHH:MM:SSZ
status: passed | gaps_found | human_needed
score: N/M must-haves verified
---

# Phase {X}: {Name} 验证报告

**Phase Goal:** {goal from ROADMAP.md}
**Verified:** {timestamp}
**Status:** {passed | gaps_found | human_needed}

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | {truth from must_haves} | ✓ VERIFIED | {what confirmed it} |
| 2 | {truth from must_haves} | ✗ FAILED | {what's wrong} |
| 3 | {truth from must_haves} | ? UNCERTAIN | {why can't verify} |

**Score:** {N}/{M} truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/Chat.tsx` | Message list component | ✓ EXISTS + SUBSTANTIVE | Exports ChatList, renders Message[], no stubs |
| `src/app/api/chat/route.ts` | Message CRUD | ✗ STUB | File exists but POST returns placeholder |
| `prisma/schema.prisma` | Message model | ✓ EXISTS + SUBSTANTIVE | Model defined with all fields |

**Artifacts:** {N}/{M} verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Chat.tsx | /api/chat | fetch in useEffect | ✓ WIRED | Line 23: `fetch('/api/chat')` with response handling |
| ChatInput | /api/chat POST | onSubmit handler | ✗ NOT WIRED | onSubmit only calls console.log |
| /api/chat POST | database | prisma.message.create | ✗ NOT WIRED | Returns hardcoded response, no DB call |

**Wiring:** {N}/{M} connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| {REQ-01}: {description} | ✓ SATISFIED | - |
| {REQ-02}: {description} | ✗ BLOCKED | API route is stub |
| {REQ-03}: {description} | ? NEEDS HUMAN | Can't verify WebSocket programmatically |

**Coverage:** {N}/{M} requirements satisfied

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/app/api/chat/route.ts | 12 | `// TODO: implement` | ⚠️ Warning | Indicates incomplete |
| src/components/Chat.tsx | 45 | `return <div>Placeholder</div>` | 🛑 Blocker | Renders no content |
| src/hooks/useChat.ts | - | File missing | 🛑 Blocker | Expected hook doesn't exist |

**Anti-patterns:** {N} found ({blockers} blockers, {warnings} warnings)

## Human Verification Required

{If no human verification needed:}
None — all verifiable items checked programmatically.

{If human verification needed:}

### 1. {Test Name}
**Test:** {What to do}
**Expected:** {What should happen}
**Why human:** {Why can't verify programmatically}

### 2. {Test Name}
**Test:** {What to do}
**Expected:** {What should happen}
**Why human:** {Why can't verify programmatically}

## Gaps Summary

{If no gaps:}
**No gaps found.** Phase goal achieved. Ready to proceed.

{If gaps found:}

### Critical Gaps (Block Progress)

1. **{Gap name}**
   - Missing: {what's missing}
   - Impact: {why this blocks the goal}
   - Fix: {what needs to happen}

2. **{Gap name}**
   - Missing: {what's missing}
   - Impact: {why this blocks the goal}
   - Fix: {what needs to happen}

### Non-Critical Gaps (Can Defer)

1. **{Gap name}**
   - Issue: {what's wrong}
   - Impact: {limited impact because...}
   - Recommendation: {fix now or defer}

## Recommended Fix Plans

{If gaps found, generate fix plan recommendations:}

### {phase}-{next}-PLAN.md: {Fix Name}

**Objective:** {What this fixes}

**Tasks:**
1. {Task to fix gap 1}
2. {Task to fix gap 2}
3. {Verification task}

**Estimated scope:** {Small / Medium}

---

### {phase}-{next+1}-PLAN.md: {Fix Name}

**Objective:** {What this fixes}

**Tasks:**
1. {Task}
2. {Task}

**Estimated scope:** {Small / Medium}

---

## Verification Metadata

**Verification approach:** Goal-backward（从阶段目标反推）
**Must-haves source:** {PLAN.md frontmatter | derived from ROADMAP.md goal}
**Automated checks:** {N} passed, {M} failed
**Human checks required:** {N}
**Total verification time:** {duration}

---
*Verified: {timestamp}*
*Verifier: Claude (subagent)*
```

---

## 指南

**Status values:**
- `passed` — 所有 must-haves 都已验证，无 blocker
- `gaps_found` — 发现一个或多个关键 gap
- `human_needed` — 自动检查通过，但仍需要人工验证

**Evidence types:**
- 对于 EXISTS："File at path, exports X"
- 对于 SUBSTANTIVE："N lines, has patterns X, Y, Z"
- 对于 WIRED："Line N: code that connects A to B"
- 对于 FAILED："Missing because X" 或 "Stub because Y"

**Severity levels:**
- 🛑 Blocker: 阻止目标达成，必须修复
- ⚠️ Warning: 表示尚未完成，但不会阻塞
- ℹ️ Info: 值得注意，但不是问题

**Fix plan generation:**
- 仅在 gaps_found 时生成
- 将相关修复归并到同一个 plan
- 每个 plan 保持 2-3 个 task
- 每个 plan 都包含 verification task

---

## 示例

```markdown
---
phase: 03-chat
verified: 2025-01-15T14:30:00Z
status: gaps_found
score: 2/5 must-haves verified
---

# Phase 3: Chat Interface 验证报告

**Phase Goal:** 可工作的聊天界面，用户可以发送和接收消息
**Verified:** 2025-01-15T14:30:00Z
**Status:** gaps_found

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 用户可以看到现有消息 | ✗ FAILED | 组件渲染的是占位内容，不是消息数据 |
| 2 | 用户可以输入消息 | ✓ VERIFIED | 输入框存在，且有 onChange handler |
| 3 | 用户可以发送消息 | ✗ FAILED | onSubmit handler 只调用了 console.log |
| 4 | 已发送消息会出现在列表中 | ✗ FAILED | 发送后没有状态更新 |
| 5 | 刷新后消息仍然保留 | ? UNCERTAIN | 无法验证 - 发送功能本身不可用 |

**Score:** 1/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/Chat.tsx` | Message list component | ✗ STUB | 返回 `<div>Chat will be here</div>` |
| `src/components/ChatInput.tsx` | Message input | ✓ EXISTS + SUBSTANTIVE | 有表单、输入框、提交按钮和 handlers |
| `src/app/api/chat/route.ts` | Message CRUD | ✗ STUB | GET 返回 [], POST 返回 { ok: true } |
| `prisma/schema.prisma` | Message model | ✓ EXISTS + SUBSTANTIVE | Message model 含 id、content、userId、createdAt |

**Artifacts:** 2/4 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Chat.tsx | /api/chat GET | fetch | ✗ NOT WIRED | 组件中没有 fetch 调用 |
| ChatInput | /api/chat POST | onSubmit | ✗ NOT WIRED | handler 只记录日志，没有发请求 |
| /api/chat GET | database | prisma.message.findMany | ✗ NOT WIRED | 返回硬编码 [] |
| /api/chat POST | database | prisma.message.create | ✗ NOT WIRED | 返回 { ok: true }，没有 DB 调用 |

**Wiring:** 0/4 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| CHAT-01: User can send message | ✗ BLOCKED | API POST 是 stub |
| CHAT-02: User can view messages | ✗ BLOCKED | 组件只是占位内容 |
| CHAT-03: Messages persist | ✗ BLOCKED | 没有数据库集成 |

**Coverage:** 0/3 requirements satisfied

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/Chat.tsx | 8 | `<div>Chat will be here</div>` | 🛑 Blocker | 没有实际内容 |
| src/app/api/chat/route.ts | 5 | `return Response.json([])` | 🛑 Blocker | 硬编码空数据 |
| src/app/api/chat/route.ts | 12 | `// TODO: save to database` | ⚠️ Warning | 尚未完成 |

**Anti-patterns:** 3 found (2 blockers, 1 warning)

## Human Verification Required

在自动化 gap 修复前，无需人工验证。

## Gaps Summary

### Critical Gaps (Block Progress)

1. **Chat 组件只是占位内容**
   - Missing: 实际的消息列表渲染
   - Impact: 用户看到的是 "Chat will be here"，而不是消息
   - Fix: 实现 Chat.tsx 以拉取并渲染消息

2. **API routes 是 stubs**
   - Missing: GET 和 POST 中的数据库集成
   - Impact: 没有数据持久化，也没有真实功能
   - Fix: 在 route handlers 中接入 prisma 调用

3. **前后端之间没有 wiring**
   - Missing: 组件中的 fetch 调用
   - Impact: 即使 API 正常，UI 也不会调用它
   - Fix: 在 Chat 中加入 useEffect fetch，在 ChatInput 中加入 onSubmit fetch

## Recommended Fix Plans

### 03-04-PLAN.md: 实现 Chat API

**Objective:** 将 API routes 接到数据库

**Tasks:**
1. 使用 prisma.message.findMany 实现 GET /api/chat
2. 使用 prisma.message.create 实现 POST /api/chat
3. 验证：API 返回真实数据，POST 会创建记录

**Estimated scope:** Small

---

### 03-05-PLAN.md: 实现 Chat UI

**Objective:** 将 Chat 组件接到 API

**Tasks:**
1. 实现带 useEffect fetch 和消息渲染的 Chat.tsx
2. 将 ChatInput onSubmit 接到 POST /api/chat
3. 验证：消息可显示，发送后可看到新消息

**Estimated scope:** Small

---

## Verification Metadata

**Verification approach:** Goal-backward（从阶段目标反推）
**Must-haves source:** 03-01-PLAN.md frontmatter
**Automated checks:** 2 passed, 8 failed
**Human checks required:** 0（被自动化失败阻塞）
**Total verification time:** 2 min

---
*Verified: 2025-01-15T14:30:00Z*
*Verifier: Claude (subagent)*
```
