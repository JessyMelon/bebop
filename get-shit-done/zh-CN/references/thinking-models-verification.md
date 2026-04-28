# 思维模型：验证类

面向 **verifier** 和 **plan-checker** agent 的结构化推理模型。在验证轮次中使用，而不是持续使用。每个模型都针对一种有文档记录的特定失败模式。

来源：基于 [thinking-partner](https://github.com/mattnowdev/thinking-partner) 模型目录（150+ models）整理。筛选标准是与 GSD verification 工作流直接相关。

## 冲突处理

**Inversion** 和 **Confirmation Bias Counter** 都在找失败，但用途不同。应按顺序运行：

1. **先做 Inversion**（头脑风暴）：想出 3 种它可能出错的方式
2. **再做 Confirmation Bias Counter**（结构化检查）：找出一个部分满足的需求、一个有误导性的测试、一个未覆盖的错误路径

Inversion 负责生成清单；Confirmation Bias Counter 负责用纪律去验证清单项。

## 1. 反向思考

**用于防止：** verifier 只确认成功，而不是主动找失败。

不要检查哪里是对的，而是列出 3 种这个实现即使测试通过也可能是错的具体方式：遗漏边界情况、静默数据丢失、竞争条件、未处理的错误路径。对每一种方式，写一个具体检查（grep 某模式、用特定输入测试、验证存在错误处理）。另外，还要检查 SUMMARY.md 中记录的任何 DEVIATION 是否改变了 must-have 的含义或适用性。如果 must-have 原本是按方案 A 写的，但 executor 实际用了方案 B，那么可能需要重新解释该 must-have，而不是照字面去查。

## 2. 切斯特顿围栏

**用于防止：** 把有意设计的代码误标为死代码或不必要代码。

在把任何现有代码标记为死代码、冗余或过度复杂之前，先搞清楚它**为什么**会那样写。检查 git blame、注释、测试用例，以及创建它的 PLAN.md。如果原因不清楚，就标记为“purpose unknown -- recommend keeping with WARNING, not removing”，并附上引入该代码的 git blame hash。

## 3. 确认偏误对冲

**用于防止：** verifier 因受 SUMMARY.md 中的声明影响，而倾向于看到“成功”。

完成初轮验证后，再做一轮 DISCONFIRMATION： (1) 找一个只被部分满足的需求，(2) 找一个虽然通过但其实没有测试宣称行为的测试，(3) 找一个没有测试覆盖的错误路径。即使整体验证通过，也要报告这些问题。

## 4. 规划谬误校准

**用于防止：** 把范围过大的计划当成合理（plan-checker）。

对每个被估为 “simple” 或 “small” 的任务，检查：它是否触及超过 2 个文件？是否需要理解陌生 API？是否修改共享基础设施？任一答案为是，都应标记为可能被低估。超过 5 个任务的计划，或单任务触及超过 4 个文件的计划，都属于范围过大。

## 5. 反事实思维

**用于防止：** 计划假设每一步都会成功，完全没有错误恢复路径（plan-checker）。

对每个计划都问一句：“如果 executor **完全照着**这个计划执行，但遇到了一个常见失败：依赖版本不匹配、API 返回意外格式、文件已被前一个计划修改，会发生什么？” 如果计划没有应对路径，且 `<action>` 步骤处处假设成功，就标记为 WARNING：`No error recovery path for task T{n}.`

---

## 何时不必启用这些模型

在以下情况下，跳过结构化推理模型：

- **对已通过项的再次验证** -- 在 re-verification 模式下，初次检查已通过的项只需要快速回归检查（存在性 + 基本合理性），不需要完整的 Inversion + Confirmation Bias Counter。
- **二元存在性检查** -- 如果某个 must-have 是“文件 X 存在且超过 N 行”，并且该文件显然存在且内容充实，就不要对它做 Counterfactual Thinking。把模型留给那些含糊或依赖连线关系的 must-have。
- **明确的测试结果** -- 如果 `<verify>` 命令给出清晰的通过/失败输出（例如测试套件退出码为 0，且所有测试通过），就接受结果。只有当测试结果含糊，或你怀疑测试并未真正验证它所宣称的内容时，才调用模型。
- **INFO 级问题** -- 不要用结构化推理去判断某个 INFO 级观察是否其实是 BLOCKER。INFO 项本身就是信息性内容，不会触发关卡。
