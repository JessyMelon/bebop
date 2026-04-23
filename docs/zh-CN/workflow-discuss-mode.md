# Discuss 模式：假设 vs 访谈

GSD 的 discuss-phase 提供两种在规划前收集实现上下文的模式。

## 模式

### `discuss`（默认）

原始的访谈式流程。Claude 会识别阶段中的灰色区域，先让你选择，再针对每个区域提问大约 4 个问题。适合：

- 代码库还是新的早期阶段
- 用户有强烈偏好，希望主动表达出来
- 喜欢引导式、对话式上下文收集的用户

### `assumptions`

先看代码库的流程。Claude 会通过子代理深入分析代码库（读取 5-15 个相关文件），形成带证据的假设，然后让你确认或修正。适合：

- 具有清晰模式的成熟代码库
- 觉得访谈问题太显而易见的用户
- 想更快收集上下文的场景（约 2-4 次交互，而不是 15-20 次）

## 配置

```bash
# 启用假设模式
node gsd-tools.cjs config-set workflow.discuss_mode assumptions

# 切回访谈模式
node gsd-tools.cjs config-set workflow.discuss_mode discuss
```

这个设置是按项目保存的（存放在 `.planning/config.json`）。

## 假设模式如何工作

1. **初始化** - 与 discuss 模式相同（加载之前的上下文、侦察代码库、检查 todos）
2. **深度分析** - 探索子代理读取与阶段相关的 5-15 个代码文件
3. **暴露假设** - 每个假设都包含：
   - Claude 会做什么以及为什么（带文件路径引用）
   - 如果假设不正确会出什么问题
   - 置信度（Confident / Likely / Unclear）
4. **确认或修正** - 用户审阅这些假设，挑出需要修改的项
5. **写入 CONTEXT.md** - 输出格式与 discuss 模式完全一致

## 标志兼容性

| 标志 | `discuss` 模式 | `assumptions` 模式 |
|------|----------------|-------------------|
| `--auto` | 自动选择推荐答案 | 跳过确认门，自动处理 Unclear 项 |
| `--batch` | 按批次分组问题 | 不适用（假设已批量呈现） |
| `--text` | 纯文本问题（远程会话） | 纯文本问题（远程会话） |
| `--analyze` | 显示每个问题的权衡表 | 不适用（假设已包含证据） |

## 输出

两种模式都会生成相同的 CONTEXT.md，并包含同样的 6 个部分：
- `<domain>` - 阶段边界
- `<decisions>` - 已锁定的实现决策
- `<canonical_refs>` - 下游代理必须读取的规格/文档
- `<code_context>` - 可复用资产、模式、集成点
- `<specifics>` - 用户引用和偏好
- `<deferred>` - 记录到未来阶段的想法

下游代理（researcher、planner、checker）无论使用哪种模式，消费方式都完全一致。
