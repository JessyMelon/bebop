# Review 评分规则

## 目的

本文件定义 `coder-llm-wiki` review 阶段的统一评审标尺。

目标：
- 让 review 从主观印象变成稳定口径
- 让不同操作者对 `Pass / Pass With Questions / Fail` 有一致理解
- 让质量门的执行更具体

## Review 模板 维度

每篇文档至少从以下 5 个维度评审：

1. Completeness
2. 证据 Quality
3. Fact / Inference Separation
4. Consistency
5. Risk / Test Coverage

增量更新时，再加第 6 个维度：

6. Freshness

## 评分尺度

每个维度使用 3 档：

- `Strong`
- `Adequate`
- `Weak`

## 1. Completeness

### Strong
- 关键章节完整
- 不是模板占位填空
- 足以支撑下一步分析或维护

### Adequate
- 主体完整
- 存在少量简略章节，但不影响整体可用性

### Weak
- 关键章节缺失
- 大量空泛描述
- 无法支撑后续使用

## 2. 证据 Quality

### Strong
- 关键结论均有具体 evidence
- 引用尽量到文件和行号范围
- evidence 能清楚解释“为什么支持这个结论”

### Adequate
- 大多数关键结论有 evidence
- 少数条目仍偏宽泛，但整体可接受

### Weak
- 结论明显强于 evidence
- evidence 过于笼统，或多数结论无支撑

## 3. Fact / Inference Separation

### Strong
- 事实、推断、问题边界清晰
- 不确定处进入 开放问题 或明确标注 inference

### Adequate
- 偶有轻微混写，但不会误导后续使用者

### Weak
- 多处把推断写成事实
- 文档整体可信度受损

## 4. Consistency

### Strong
- 与 index、module、flow、evidence 文档一致
- 命名统一
- 路径引用稳定

### Adequate
- 存在小的不一致，但可快速修复

### Weak
- 与其他文档冲突明显
- 命名或职责表述混乱

## 5. Risk / Test Coverage

### Strong
- 风险和测试引用真实、具体
- 不只写 happy path
- 对关键失败面和覆盖缺口有意识

### Adequate
- 已提及风险和测试，但深度一般

### Weak
- 风险章节空泛或缺失
- 测试覆盖关系没有核实

## 6. Freshness

仅对增量更新或旧文档复查时使用。

### Strong
- 文档与当前代码一致
- stale evidence 已被替换或删除

### Adequate
- 主体仍有效，存在少量待同步项

### Weak
- 文档明显过时
- evidence 或路径大量失效

## 结论规则

### Pass

适用条件：
- 无 `Weak` 项
- 至少 4 个核心维度达到 `Adequate` 或以上
- 没有阻断后续使用的冲突

### Pass With Questions

适用条件：
- 没有致命问题
- 存在 1 到 2 个需要后续追踪的问题
- 主体内容仍可靠

### Fail

适用条件：
- 任一关键维度为明显 `Weak` 且影响可信度
- 关键 evidence 缺失
- 与其他文档存在重大冲突

## Review 模板 输出格式

每次 review 建议至少输出：

- Artifact: `<path>`
- Verdict: `Pass | Pass With Questions | Fail`
- Dimension Scores:
  - Completeness:
  - 证据 Quality:
  - Fact / Inference Separation:
  - Consistency:
  - Risk / Test Coverage:
  - Freshness:
- Findings:
  - `<finding>`
- Required Fixes:
  - `<fix>`
- 开放问题:
  - `<question>`

## 快速启发式检查

如果 review 时间有限，优先问这 5 个问题：

1. 这篇文档最重要的 3 个结论，各自证据在哪？
2. 有没有把猜测写成事实？
3. 有没有遗漏失败路径、风险或副作用？
4. 与其他文档是否冲突？
5. 如果今天改代码的人来看，这篇文档会不会误导他？

## 核心结论

review 的目标不是挑语病，而是阻止错误知识进入 wiki 并长期存活。
