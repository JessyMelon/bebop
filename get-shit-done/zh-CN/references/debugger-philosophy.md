# Debugger Philosophy

常青的调试纪律 —— 适用于所有 bug、所有语言、所有系统。由 `gsd-debugger` 通过 `@file` include 加载。

## User = Reporter, Claude = Investigator

用户知道的是：
- 他们原本期望发生什么
- 实际发生了什么
- 他们看到的错误信息
- 它是什么时候开始出现的 / 以前是否工作过

用户**不知道**的是（不要问他们）：
- bug 是什么原因造成的
- 问题在哪个文件里
- 修复方案应该是什么

问他们体验层面的情况。原因由你自己去调查。

## Meta-Debugging: Your Own Code

当你调试自己写的代码时，你对抗的是自己的心智模型。

**Why this is harder:**
- 设计决策是你自己做的 —— 它们会让你觉得理所当然地正确
- 你记得的是意图，而不是你实际实现了什么
- 熟悉会让你对 bug 视而不见

**The discipline:**
1. **Treat your code as foreign** - 像读别人写的代码一样去读它
2. **Question your design decisions** - 你的实现决策只是假设，不是事实
3. **Admit your mental model might be wrong** - 代码行为才是真相；你的模型只是猜测
4. **Prioritize code you touched** - 如果你改了 100 行然后东西坏了，那 100 行就是头号嫌疑人

**The hardest admission:** “我把这个实现错了。”而不是“需求不够清晰” —— 是**你**犯了错。

## Foundation Principles

调试时，回到基础事实：

- **What do you know for certain?** 可观察事实，而不是假设
- **What are you assuming?** “这个库应该这么工作” —— 你验证过吗？
- **Strip away everything you think you know.** 从可观察事实出发重建理解。

## Cognitive Biases to Avoid

| Bias | Trap | Antidote |
|------|------|----------|
| **Confirmation** | 只寻找支持你假设的证据 | 主动寻找反证。问自己：“什么能证明我是错的？” |
| **Anchoring** | 第一个解释成为锚点 | 在调查任何一个前，先独立生成 3 个以上假设 |
| **Availability** | 最近见过类似 bug，就假定原因也类似 | 在证据出现前，把每个 bug 都当成新的问题 |
| **Sunk Cost** | 在一条路上花了 2 小时，即使有反证也继续走 | 每 30 分钟问一次：“如果我现在重新开始，还会选这条路吗？” |

## Systematic Investigation Disciplines

**Change one variable:** 一次只改一个变量，测试、观察、记录，再重复。一次改多个，就无法知道到底什么起了作用。

**Complete reading:** 把整个函数读完，而不是只读“看起来相关”的几行。也要读 imports、config、tests。扫读会漏掉关键细节。

**Embrace not knowing:** “我不知道为什么会失败” = 好事（现在你才能开始调查）。而“肯定是 X” = 危险（说明你已经停止思考了）。

## When to Restart

在以下情况下，考虑从头开始：
1. **2+ hours with no progress** - 你大概率已经陷入 tunnel vision
2. **3+ "fixes" that didn't work** - 你的心智模型是错的
3. **You can't explain the current behavior** - 不要在困惑之上继续加改动
4. **You're debugging the debugger** - 某些基础前提出了问题
5. **The fix works but you don't know why** - 这不叫修复，只是运气好

**Restart protocol:**
1. 关掉所有文件和终端
2. 写下你确定知道的事实
3. 写下你已经排除的内容
4. 列出新的假设（与之前不同）
5. 从 Phase 1: Evidence Gathering 重新开始
