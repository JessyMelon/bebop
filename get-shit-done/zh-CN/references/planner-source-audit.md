# 规划器来源审计与权限边界

`agents/gsd-planner.md` 的参考文档，补充了多来源覆盖审计规则和规划器权限约束。

## 多来源覆盖审计格式

在最终敲定计划前，生成一份覆盖全部四类工件的 **source audit**：

```
SOURCE    | ID      | Feature/Requirement          | Plan  | Status    | Notes
--------- | ------- | ---------------------------- | ----- | --------- | ------
GOAL      | —       | {phase goal from ROADMAP.md}  | 01-03 | COVERED   |
REQ       | REQ-14  | OAuth login with Google + GH | 02    | COVERED   |
REQ       | REQ-22  | Email verification flow      | 03    | COVERED   |
RESEARCH  | —       | Rate limiting on auth routes | 01    | COVERED   |
RESEARCH  | —       | Refresh token rotation       | NONE  | ⚠ MISSING | No plan covers this
CONTEXT   | D-01    | Use jose library for JWT     | 02    | COVERED   |
CONTEXT   | D-04    | 15min access / 7day refresh  | 02    | COVERED   |
```

### 四类来源

1. **GOAL** - 本阶段在 ROADMAP.md 中的 `goal:` 字段，是主要成功条件。
2. **REQ** - `phase_req_ids` 中的每个 REQ-ID。与 REQUIREMENTS.md 交叉引用获取描述。
3. **RESEARCH** - RESEARCH.md 中识别出的技术方案、发现的约束和功能。排除研究者已明确标记为 “out of scope” 或 “future work” 的项目。
4. **CONTEXT** - CONTEXT.md 中 `<decisions>` 部分的每个 D-XX 决策。

### 哪些不算缺口

不要将以下内容标记为 MISSING：
- CONTEXT.md 中 `## Deferred Ideas` 下的项目，开发者已选择暂缓
- 通过 `phase_req_ids` 归属到其他阶段的项目，不属于当前阶段
- RESEARCH.md 中研究者已明确标记为 “out of scope” 或 “future work” 的项目

### 处理 MISSING 项

如果任意一行是 `⚠ MISSING`，不要默默完成整组计划。应返回给 orchestrator：

```
## ⚠ 来源审计：发现未规划项

以下来源工件中的项目没有对应计划：

1. **{SOURCE}: {item description}**（来自 {artifact file}，章节 "{section}"）
   - {why this was identified as required}

   可选项：
   A) 添加计划以覆盖该项
   B) 拆分阶段：移入子阶段
   C) 明确暂缓：经开发者确认后加入 backlog

   → 在最终确定计划集之前，等待开发者决策。
```

如果所有行都是 COVERED，则正常返回 `## PLANNING COMPLETE`。

---

## 权限边界 - 约束示例

规划器拆分功能或标记功能的唯一正当理由是 **约束**，而不是对难度的判断：

**有效（约束）：**
- ✓ “这个任务会涉及 9 个文件，并消耗约 45% 的上下文，应该拆成两个任务”
- ✓ “任何来源工件中都没有定义 API key 或 endpoint，需要开发者输入”
- ✓ “此功能依赖第 03 阶段构建的认证系统，而该系统尚未完成”

**无效（难度判断）：**
- ✗ “这个很复杂，可能难以正确实现”
- ✗ “集成外部服务可能会花很长时间”
- ✗ “这是个有挑战的功能，也许更适合留到未来阶段”

如果一个功能不具备这三类正当约束之一（上下文成本、信息缺失、依赖冲突），那它就应该被规划进去。就是这样。
