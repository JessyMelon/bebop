# 通用反模式

适用于**所有**工作流和 agent 的规则。各个工作流还可能有额外的特定 anti-pattern。

---

## 上下文预算规则

1. **绝不要**读取 agent 定义文件（`agents/*.md`）-- `subagent_type` 会自动加载它们。把 agent 定义读进 orchestrator，会浪费本应自动注入到子 agent 会话中的上下文。
2. **绝不要**把大文件内联到子 agent prompt 中 -- 应告诉 agent 自己从磁盘读取文件。agent 有自己的上下文窗口。
3. **读取深度随上下文窗口缩放** -- 检查 `.planning/config.json` 中的 `context_window`。当 < 500000 时：只读 frontmatter、status 字段或摘要。当 >= 500000（1M model）时：如果内联决策需要内容，允许读取完整正文。完整规则见 `references/context-budget.md`。
4. **把重工作委托给子 agent** -- orchestrator 负责路由，不负责构建、分析、研究、调查或验证。
5. **主动暂停警告**：如果你已经消耗了大量上下文（大文件读取、多个子 agent 结果），要提醒用户："Context budget is getting heavy. Consider checkpointing progress."

## 文件读取规则

6. **SUMMARY.md 的读取深度随上下文窗口缩放** -- 当 context_window < 500000 时：对先前 phase 的 SUMMARY 只读 frontmatter。>= 500000 时：对直接依赖 phase 允许读完整正文。传递依赖（回溯 2 个及以上 phase）无论如何都只读 frontmatter。
7. **绝不要**读取其他 phase 的完整 PLAN.md 文件 -- 只读当前 phase 的 plan。
8. **绝不要**读取 `.planning/logs/` 文件 -- 只有 health workflow 会读取它们。
9. **如果 frontmatter 已足够，就不要**重新读取完整文件内容 -- frontmatter 已包含 status、key_files、commits 和 provides 字段。例外：在 >= 500000 时，如果需要语义内容，可接受重新读完整正文。

## 子 agent 规则

10. **绝对不要**使用非 GSD agent type（`general-purpose`、`Explore`、`Plan`、`Bash`、`feature-dev` 等）-- **始终**使用 `subagent_type: "gsd-{agent}"`（例如 `gsd-phase-researcher`、`gsd-executor`、`gsd-planner`）。GSD agent 带有项目感知 prompt、审计日志和工作流上下文。通用 agent 会绕过这些。
11. **不要**重新争论已经在 CONTEXT.md（或 PROJECT.md 的 `## Context` 小节）中锁定的决策 -- 无条件尊重这些已锁定决策。

## 提问反模式

参考：完整 anti-pattern 列表见 `references/questioning.md`。

12. **不要**逐项走 checklist -- checklist walking（按列表一项项发问）是头号反模式。应使用 progressive depth：先广后深，在有价值处深入。
13. **不要**使用企业黑话 -- 避免诸如 "stakeholder alignment"、"synergize"、"deliverables" 的术语。使用直白语言。
14. **不要**过早施加约束 -- 在理解问题前，不要先收窄解空间。先问清问题，再加约束。

## 状态管理反模式

15. **不要直接对 STATE.md 或 ROADMAP.md 使用 Write/Edit 做变更。** 必须始终使用 `gsd-sdk query` 调用已注册的 state/roadmap handler（例如 `state.update`、`state.advance-plan`、`roadmap.update-plan-progress`），或对仅 CLI 命令使用旧版 `node …/gsd-tools.cjs`。直接用 Write 工具会绕过安全更新逻辑，在多会话环境中不安全。例外：首次根据模板创建 STATE.md 是允许的。

## 行为规则

16. **不要**创建用户未批准的产物 -- 写入新的规划文档前必须先确认。
17. **不要**修改工作流声明范围之外的文件 -- 检查计划中的 files_modified 列表。
18. **不要**在没有明确优先级时建议多个下一步动作 -- 给出一个主要建议，其他选项作为次要备选。
19. **不要**使用 `git add .` 或 `git add -A` -- 只暂存指定文件。
20. **不要**在规划文档或提交中包含敏感信息（API keys、passwords、tokens）。

## 错误恢复规则

21. **Git lock detection**：在任何 git 操作之前，如果它因 "Unable to create lock file" 失败，应检查是否有过期的 `.git/index.lock`，并建议用户移除（不要自动移除）。
22. **Config fallback awareness**：配置加载在 JSON 无效时会静默返回 `null`。如果你的工作流依赖配置值，应检查是否为 null，并提醒用户："config.json is invalid or missing -- running with defaults."
23. **Partial state recovery**：如果 STATE.md 引用了一个不存在的 phase 目录，不要静默继续。应提醒用户，并建议排查这个不匹配问题。

## GSD 特定规则

24. **不要**检查 `mode === 'auto'` 或 `mode === 'autonomous'` -- GSD 使用 `yolo` 配置标志。自主模式应检查 `yolo: true`，交互模式则是缺失或 `false`。
25. **优先使用 `gsd-sdk query`** 做编排，只要对应 handler 存在；如果必须调用旧 CLI，请使用 **`gsd-tools.cjs`**（不要用 `gsd-tools.js` 或其他文件名）—— GSD 以 CommonJS 形式提供程序化 API，以兼容 Node.js CLI。
26. **Plan 文件必须遵循 `{padded_phase}-{NN}-PLAN.md` 模式**（例如 `01-01-PLAN.md`）。绝不要使用 `PLAN-01.md`、`plan-01.md` 或其他变体 -- `gsd-tools` 的检测依赖这个精确模式。
27. **在为当前 plan 写完 SUMMARY.md 之前，不要开始执行下一个 plan** -- 下游 plan 可能会通过 `@` include 引用它。

## iOS / Apple 平台规则

28. **绝不要把 `Package.swift` + `.executableTarget`（或 `.target`）作为 iOS app 的主构建系统。** SPM executable target 产出的是 macOS CLI 二进制，而不是 iOS `.app` bundle。它们不能安装到 iOS 设备上，也不能提交到 App Store。应使用 XcodeGen（`project.yml` + `xcodegen generate`）生成正确的 `.xcodeproj`。完整模式见 `references/ios-scaffold.md`。
29. **使用 SwiftUI API 前先验证可用性。** 许多 SwiftUI API 依赖特定最低 iOS 版本（例如 `NavigationSplitView` 需要 iOS 16+，带多选的 `List(selection:)` 和 `@Observable` 需要 iOS 17）。如果计划使用的 API 超过已声明的 `IPHONEOS_DEPLOYMENT_TARGET`，就提高部署目标或添加 `#available` guard。
