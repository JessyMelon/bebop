# Snapshots

本目录为每个任务或批次保存一个检查点文件。

建议结构：

```json
{
  "id": "module-auth",
  "type": "module",
  "status": "review-needed",
  "last_stage": "evidence-linked",
  "outputs": [
    "coder-llm-wiki/03-modules/auth.md",
    "coder-llm-wiki/08-evidence/auth.refs.md"
  ],
  "blockers": [],
  "updated_at": "2026-04-19T00:00:00Z"
}
```
