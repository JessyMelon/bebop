# Code Agent Seed

本目录保存由 Codex、OpenCode、Claude Code 或当前运行环境生成/导入的仓库分析种子。

## 深度

- `quick`：生成单个简洁 seed 文件，用于快速给出候选模块、候选流程、候选源码文件和开放问题。
- `full`：生成结构化 seed 目录，包含架构、数据流、设计说明、候选模块、候选流程和开放问题，适合在已有 wiki 较薄时作为深入分析入口。

## 使用边界

- Seed 只能帮助选择阅读顺序、候选模块、候选流程和待验证问题。
- Seed 不是证据，不能写入 completed task 的 `evidence_paths`。
- 如果任务来自 seed，请把 seed 文件写入 `seed_paths`，并在完成前补齐真实源码、配置、测试或脚本证据。
- 不能确认的结论必须写入 `09-review/`，不能写成事实。

## Quick 推荐格式

- 候选架构结论
- 候选数据流
- 候选设计约束
- 候选源码文件
- 建议 module / flow / risk 任务
- Open Questions

## Full 推荐目录

- `README.md`
- `architecture.md`
- `data-flow.md`
- `design-notes.md`
- `candidate-modules.md`
- `candidate-flows.md`
- `open-questions.md`
