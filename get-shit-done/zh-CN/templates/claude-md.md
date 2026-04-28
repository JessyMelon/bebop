# CLAUDE.md 模板

用于项目根目录 `CLAUDE.md` 的模板，由 `gsd-tools generate-claude-md` 自动生成。

包含 7 个由标记边界限定的区块。每个区块都可独立更新。
`generate-claude-md` 子命令负责管理其中 6 个区块（project、stack、conventions、architecture、skills、workflow enforcement）。
profile 区块仅由 `generate-claude-profile` 管理。

---

## 区块模板

### Project 区块
```
<!-- GSD:project-start source:PROJECT.md -->
## Project

{{project_content}}
<!-- GSD:project-end -->
```

**回退文本：**
```
项目尚未初始化。运行 /gsd-new-project 进行设置。
```

### Stack 区块
```
<!-- GSD:stack-start source:STACK.md -->
## 技术栈

{{stack_content}}
<!-- GSD:stack-end -->
```

**回退文本：**
```
技术栈尚未记录。会在代码库映射完成后或第一阶段后填充。
```

### Conventions 区块
```
<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

{{conventions_content}}
<!-- GSD:conventions-end -->
```

**回退文本：**
```
约定尚未建立。会在开发过程中模式逐渐清晰后填充。
```

### Architecture 区块
```
<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

{{architecture_content}}
<!-- GSD:architecture-end -->
```

**回退文本：**
```
架构尚未梳理。请遵循代码库中已有的模式。
```

### Skills 区块
```
<!-- GSD:skills-start source:skills/ -->
## 项目技能

| Skill          | Description           | Path                      |
| -------------- | --------------------- | ------------------------- |
| {{skill_name}} | {{skill_description}} | `{{skill_path}}/SKILL.md` |
<!-- GSD:skills-end -->
```

**回退文本：**
```
未发现项目技能。可将技能添加到 `.claude/skills/`、`.agents/skills/`、`.cursor/skills/` 或 `.github/skills/`，并提供 `SKILL.md` 索引文件。
```

**发现行为：**
- 扫描 `.claude/skills/`、`.agents/skills/`、`.cursor/skills/`、`.github/skills/` 中包含 `SKILL.md` 的子目录
- 从 YAML frontmatter 中提取 `name` 和 `description`（支持多行 description）
- 跳过 GSD 自带已安装技能（目录名以 `gsd-` 开头）
- 按技能名跨目录去重

### 工作流约束区块
```
<!-- GSD:workflow-start source:GSD defaults -->
## GSD 工作流约束

在使用 Edit、Write 或其他会修改文件的工具之前，应先通过 GSD 命令启动工作，以保持规划产物与执行上下文同步。

使用以下入口：
- `/gsd-quick` 用于小修复、文档更新和临时任务
- `/gsd-debug` 用于调查和修复 bug
- `/gsd-execute-phase` 用于按计划执行阶段性工作

除非用户明确要求绕过，否则不要在 GSD 工作流之外直接修改仓库。
<!-- GSD:workflow-end -->
```

### Profile 区块（仅占位）
```
<!-- GSD:profile-start -->
## 开发者画像

> Profile 尚未配置。运行 `/gsd-profile-user` 生成你的 developer profile。
> 此 section 由 `generate-claude-profile` 管理，不要手动编辑。
<!-- GSD:profile-end -->
```

**注意：** 这个区块不由 `generate-claude-md` 管理。它仅由
`generate-claude-profile` 管理。上面的占位内容只会在新建
`CLAUDE.md` 且尚不存在 profile 区块时使用。

---

## 区块顺序

1. **Project** — 身份与目的（这个项目是什么）
2. **Stack** — 技术选择（使用了哪些工具）
3. **Conventions** — 代码模式与规则（代码如何编写）
4. **Architecture** — 系统结构（组件如何组合）
5. **Skills** — 已发现的项目技能及其名称和描述（有哪些领域知识可用）
6. **工作流约束** — 涉及文件变更工作时默认使用的 GSD 入口
7. **Profile** — 开发者行为偏好（如何互动）

## 标记格式

- 起始：`<!-- GSD:{name}-start source:{file} -->`
- 结束：`<!-- GSD:{name}-end -->`
- `source` 属性用于在源文件变化时进行定向更新
- 通过对起始 marker 做部分匹配（不含结尾 `-->`）进行检测

## Fallback 行为

当源文件缺失时，回退文本会为 Claude 提供可执行指导：
- 在缺少数据时指导 Claude 的行为
- 不是占位广告，也不是“文件缺失”提示
- 每段回退文本都告诉 Claude 该做什么，而不只是说明缺少了什么
