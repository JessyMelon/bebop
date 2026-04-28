<purpose>
创建关闭 `/gsd-audit-milestone` 识别出的缺口所需的全部阶段。读取 MILESTONE-AUDIT.md，将缺口按逻辑分组为阶段，在 ROADMAP.md 中创建阶段条目，并提供规划每个阶段的选项。一次命令创建所有修复阶段，无需为每个缺口手动执行 `/gsd-add-phase`。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<process>

## 1. 加载审计结果

```bash
# 查找最新的审计文件
(ls -t .planning/v*-MILESTONE-AUDIT.md 2>/dev/null || true) | head -1
```

解析 YAML frontmatter 以提取结构化缺口：
- `gaps.requirements` — 未满足的需求
- `gaps.integration` — 缺失的跨阶段连接
- `gaps.flows` — 损坏的 E2E 流程

如果不存在审计文件，或文件中没有缺口，报错：
```
No audit gaps found. Run `/gsd-audit-milestone` first.
```

## 2. 确定缺口优先级

按 REQUIREMENTS.md 中的优先级对缺口分组：

| Priority | Action |
|----------|--------|
| `must` | 创建阶段，阻塞里程碑 |
| `should` | 创建阶段，建议处理 |
| `nice` | 询问用户：纳入还是延后？ |

对于 integration/flow 缺口，从受影响的需求推断优先级。

## 3. 将缺口分组为阶段

将相关缺口聚类为逻辑阶段：

**分组规则：**
- 影响同一阶段 → 合并为一个修复阶段
- 同一子系统（auth、API、UI）→ 合并
- 按依赖顺序（先修复 stub，再做 wiring）
- 保持阶段聚焦：每个阶段 2-4 个任务

**分组示例：**
```
Gap: DASH-01 unsatisfied (Dashboard doesn't fetch)
Gap: Integration Phase 1→3 (Auth not passed to API calls)
Gap: Flow "View dashboard" broken at data fetch

→ Phase 6: "Wire Dashboard to API"
  - Add fetch to Dashboard.tsx
  - Include auth header in fetch
  - Handle response, update state
  - Render user data
```

## 4. 确定阶段编号

找到当前最高阶段：

```bash
# 获取已排序的阶段列表，并提取最后一个
HIGHEST=$(gsd-sdk query phases.list --pick directories[-1])
```

新阶段从该编号继续：
- 如果最高是 Phase 5，则缺口将成为 Phase 6、7、8...

## 5. 展示缺口关闭计划

```markdown
## Gap Closure Plan

**Milestone:** {version}
**Gaps to close:** {N} requirements, {M} integration, {K} flows

### Proposed Phases

**Phase {N}: {Name}**
Closes:
- {REQ-ID}: {description}
- Integration: {from} → {to}
Tasks: {count}

**Phase {N+1}: {Name}**
Closes:
- {REQ-ID}: {description}
- Flow: {flow name}
Tasks: {count}

{If nice-to-have gaps exist:}

### Deferred (nice-to-have)

These gaps are optional. Include them?
- {gap description}
- {gap description}

---

Create these {X} phases? (yes / adjust / defer all optional)
```

等待用户确认。

## 6. 更新 ROADMAP.md

将新阶段添加到当前里程碑：

```markdown
### Phase {N}: {Name}
**Goal:** {derived from gaps being closed}
**Requirements:** {REQ-IDs being satisfied}
**Gap Closure:** Closes gaps from audit

### Phase {N+1}: {Name}
...
```

## 7. 更新 REQUIREMENTS.md 可追踪性表（必需）

对于分配到缺口关闭阶段的每个 REQ-ID：
- 更新 Phase 列，使其反映新的缺口关闭阶段
- 将 Status 重置为 `Pending`

重置审计判定为未满足的已勾选需求：
- 将 `[x]` → `[ ]`，适用于审计中标记为未满足的任何需求
- 更新 REQUIREMENTS.md 顶部的覆盖计数

```bash
# 验证可追踪性表已反映缺口关闭分配
grep -c "Pending" .planning/REQUIREMENTS.md
```

## 8. 创建阶段目录

```bash
mkdir -p ".planning/phases/{NN}-{name}"
```

## 9. 提交路线图和需求更新

```bash
gsd-sdk query commit "docs(roadmap): add gap closure phases {N}-{M}" .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## 10. 提供后续步骤

```markdown
## ✓ Gap Closure Phases Created

**Phases added:** {N} - {M}
**Gaps addressed:** {count} requirements, {count} integration, {count} flows

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**先规划第一个缺口关闭阶段**

`/clear` then:

`/gsd-plan-phase {N}`

---

**也可使用：**
- `/gsd-execute-phase {N}` — 如果计划已存在
- `cat .planning/ROADMAP.md` — 查看更新后的路线图

---

**在所有缺口阶段完成后：**

`/gsd-audit-milestone` — 重新审计以验证缺口已关闭
`/gsd-complete-milestone {version}` — 审计通过后归档
```

</process>

<gap_to_phase_mapping>

## 缺口如何变成任务

**需求缺口 → Tasks：**
```yaml
gap:
  id: DASH-01
  description: "用户能看到自己的数据"
  reason: "Dashboard 已存在，但不会从 API 获取数据"
  missing:
    - "挂载时用 useEffect 调用 fetch 到 /api/user/data"
    - "用于用户数据的 state"
    - "在 JSX 中渲染用户数据"

becomes:

phase: "接通 Dashboard 数据"
tasks:
  - name: "添加数据获取"
    files: [src/components/Dashboard.tsx]
    action: "添加 useEffect，在挂载时获取 /api/user/data"

  - name: "添加状态管理"
    files: [src/components/Dashboard.tsx]
    action: "为 userData、loading、error 状态添加 useState"

  - name: "渲染用户数据"
    files: [src/components/Dashboard.tsx]
    action: "用 userData.map 渲染替换占位内容"
```

**集成缺口 → Tasks：**
```yaml
gap:
  from_phase: 1
  to_phase: 3
  connection: "Auth token → API calls"
  reason: "Dashboard API 调用未包含 auth header"
  missing:
    - "fetch 调用中的 auth header"
    - "401 时刷新 token"

becomes:

phase: "为 Dashboard API 调用添加 Auth"
tasks:
  - name: "为 fetch 添加 auth header"
    files: [src/components/Dashboard.tsx, src/lib/api.ts]
    action: "在所有 API 调用中附带带有 token 的 Authorization header"

  - name: "处理 401 响应"
    files: [src/lib/api.ts]
    action: "添加拦截器，在 401 时刷新 token 或重定向到登录页"
```

**流程缺口 → Tasks：**
```yaml
gap:
  name: "用户登录后查看 dashboard"
  broken_at: "Dashboard 数据加载"
  reason: "没有 fetch 调用"
  missing:
    - "挂载时获取用户数据"
    - "显示 loading 状态"
    - "渲染用户数据"

becomes:

# 通常与 requirement/integration 缺口属于同一阶段
# Flow 缺口通常与其他缺口类型重叠
```

</gap_to_phase_mapping>

<success_criteria>
- [ ] 已加载 MILESTONE-AUDIT.md 并解析缺口
- [ ] 已确定缺口优先级（must/should/nice）
- [ ] 已将缺口分组为逻辑阶段
- [ ] 用户已确认阶段计划
- [ ] 已用新阶段更新 ROADMAP.md
- [ ] 已用缺口关闭阶段分配更新 REQUIREMENTS.md 可追踪性表
- [ ] 已重置未满足需求的复选框（`[x]` → `[ ]`）
- [ ] 已更新 REQUIREMENTS.md 中的覆盖计数
- [ ] 已创建阶段目录
- [ ] 更改已提交（包含 REQUIREMENTS.md）
- [ ] 用户知道接下来运行 `/gsd-plan-phase`
</success_criteria>
