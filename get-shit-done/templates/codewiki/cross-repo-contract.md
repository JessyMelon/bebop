# 跨仓库契约：[contract-name]

**Set:** [set-id]  
**状态:** [current|stale|blocked]  
**最后 Review:** [YYYY-MM-DD]  

## 生产方

- Repo: `[repo-id]`
- 暴露面: `[API/module/event/package]`
- 文件: `path/to/file.ext`

## 消费方

- Repo: `[repo-id]`
  - 使用方式: [消费方如何依赖这个契约]
  - 文件: `path/to/file.ext`

## 契约面

[描述请求/响应结构、导出符号、事件载荷、CLI 契约、包 API 或集成边界。]

## 兼容性规则

- [跨仓库必须保持成立的规则]

## 失败模式

- [生产方和消费方发生偏移时会破坏什么]

## 证据

- 生产方: `path/to/file.ext:line-range` - [为什么支撑该契约]
- 消费方: `path/to/file.ext:line-range` - [为什么证明该使用方式]

## 开放问题

- [尚未解决的问题或兼容性风险]
