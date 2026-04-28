---
phase: {N}
slug: {phase-slug}
status: draft
nyquist_compliant: false
wave_0_complete: false
created: {date}
---

# Phase {N} — 验证策略

> 执行期间用于反馈采样的分阶段验证契约。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | {pytest 7.x / jest 29.x / vitest / go test / other} |
| **Config file** | {path or "none — Wave 0 installs"} |
| **Quick run command** | `{quick command}` |
| **Full suite command** | `{full command}` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** 运行 `{quick run command}`
- **After every plan wave:** 运行 `{full suite command}`
- **Before `/gsd-verify-work`:** 完整测试套件必须为 green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `{tests/test_file.py}` — REQ-{XX} 的 stub
- [ ] `{tests/conftest.py}` — 共享 fixtures
- [ ] `{framework install}` — 如果未检测到 framework

*如无："Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*如无："All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] 所有 task 都有 `<automated>` verify 或 Wave 0 依赖
- [ ] 采样连续性：不能连续 3 个 task 都没有 automated verify
- [ ] Wave 0 覆盖所有 MISSING 引用
- [ ] 不使用 watch-mode flags
- [ ] 反馈延迟 < {N}s
- [ ] 已在 frontmatter 中设置 `nyquist_compliant: true`

**Approval:** {pending / approved YYYY-MM-DD}
