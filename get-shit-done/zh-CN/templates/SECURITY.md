---
phase: {N}
slug: {phase-slug}
status: draft
threats_open: 0
asvs_level: 1
created: {date}
---

# Phase {N} — 安全

> 分阶段安全契约：威胁登记、已接受风险与审计轨迹。

---

## 信任边界

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| {boundary} | {description} | {data type / sensitivity} |

---

## 威胁登记

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-{N}-01 | {STRIDE category} | {component} | {mitigate / accept / transfer} | {control or reference} | open |

*Status: open · closed*
*Disposition: mitigate（需要实现） · accept（已记录风险） · transfer（第三方承担）*

---

## 已接受风险记录

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*已接受的风险不会在后续审计中再次出现。*

*如无："No accepted risks."*

---

## 安全审计轨迹

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| {YYYY-MM-DD} | {N} | {N} | {N} | {name / agent} |

---

## 签署确认

- [ ] 所有威胁都有 disposition（mitigate / accept / transfer）
- [ ] 已接受风险已记录到 Accepted Risks Log
- [ ] 已确认 `threats_open: 0`
- [ ] 已在 frontmatter 中设置 `status: verified`

**Approval:** {pending / verified YYYY-MM-DD}
