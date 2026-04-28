# 需求模板

用于 `.planning/REQUIREMENTS.md` 的模板 - 可检查的需求，用来定义“完成”。

<template>

```markdown
# 需求：[Project Name]

**定义时间：** [date]
**核心价值：** [from PROJECT.md]

## v1 需求

初始版本的需求。每项需求都会映射到 roadmap 阶段。

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User session persists across browser refresh

### [Category 2]

- [ ] **[CAT]-01**: [Requirement description]
- [ ] **[CAT]-02**: [Requirement description]
- [ ] **[CAT]-03**: [Requirement description]

### [Category 3]

- [ ] **[CAT]-01**: [Requirement description]
- [ ] **[CAT]-02**: [Requirement description]

## v2 需求

延期到未来版本。会被跟踪，但不在当前 roadmap 中。

### [Category]

- **[CAT]-01**: [Requirement description]
- **[CAT]-02**: [Requirement description]

## 范围外

明确排除的内容。记录下来以防止范围蔓延。

| 功能 | 原因 |
|---------|--------|
| [Feature] | [Why excluded] |
| [Feature] | [Why excluded] |

## 可追踪性

哪些阶段覆盖哪些需求。在创建 roadmap 时更新。

| 需求 | 阶段 | 状态 |
|-------------|-------|--------|
| AUTH-01 | 阶段 1 | Pending |
| AUTH-02 | 阶段 1 | Pending |
| AUTH-03 | 阶段 1 | Pending |
| AUTH-04 | 阶段 1 | Pending |
| [REQ-ID] | 阶段 [N] | Pending |

**覆盖情况：**
- v1 需求总数：[X]
- 已映射到阶段：[Y]
- 未映射：[Z] ⚠️

---
*需求定义时间：[date]*
*最后更新：[date]，更新时机：[trigger]*
```

</template>

<guidelines>

**需求格式：**
- ID：`[CATEGORY]-[NUMBER]`（AUTH-01、CONTENT-02、SOCIAL-03）
- 描述：面向用户、可测试、原子化
- Checkbox：仅用于 v1 需求（v2 还不可执行）

**分类：**
- 来自研究中的 FEATURES.md 分类
- 与领域约定保持一致
- 常见：Authentication、Content、Social、Notifications、Moderation、Payments、Admin

**v1 vs v2：**
- v1：已承诺范围，会进入 roadmap 阶段
- v2：已确认但延期，不在当前 roadmap 中
- 将 v2 → v1 需要更新 roadmap

**范围外：**
- 带原因的明确排除项
- 防止后面再问“为什么没包含 X？”
- 研究中的 anti-features 和警告也应放在这里

**可追踪性：**
- 初始为空，在创建 roadmap 时填充
- 每个需求恰好映射到一个阶段
- 未映射需求 = roadmap 缺口

**状态值：**
- Pending：尚未开始
- 进行中：阶段进行中
- Complete：需求已验证
- Blocked：等待外部因素

</guidelines>

<evolution>

**每个阶段完成后：**
1. 将已覆盖的需求标记为 Complete
2. 更新可追踪性状态
3. 记录任何范围变更的需求

**roadmap 更新后：**
1. 验证所有 v1 需求仍已映射
2. 若范围扩大，添加新需求
3. 若范围缩减，将需求移到 v2/out of scope

**需求完成标准：**
- 当满足以下条件时，需求才算 “Complete”：
  - 功能已实现
  - 功能已验证（测试通过、已完成人工检查）
  - 功能已提交

</evolution>

<example>

```markdown
# 需求：CommunityApp

**Defined:** 2025-01-14
**核心价值：** 用户可以与兴趣相投的人分享和讨论内容

## v1 需求

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User session persists across browser refresh

### Profiles

- [ ] **PROF-01**: User can create profile with display name
- [ ] **PROF-02**: User can upload avatar image
- [ ] **PROF-03**: User can write bio (max 500 chars)
- [ ] **PROF-04**: User can view other users' profiles

### Content

- [ ] **CONT-01**: User can create text post
- [ ] **CONT-02**: User can upload image with post
- [ ] **CONT-03**: User can edit own posts
- [ ] **CONT-04**: User can delete own posts
- [ ] **CONT-05**: User can view feed of posts

### Social

- [ ] **SOCL-01**: User can follow other users
- [ ] **SOCL-02**: User can unfollow users
- [ ] **SOCL-03**: User can like posts
- [ ] **SOCL-04**: User can comment on posts
- [ ] **SOCL-05**: User can view activity feed (followed users' posts)

## v2 需求

### Notifications

- **NOTF-01**: User receives in-app notifications
- **NOTF-02**: User receives email for new followers
- **NOTF-03**: User receives email for comments on own posts
- **NOTF-04**: User can configure notification preferences

### Moderation

- **MODR-01**: User can report content
- **MODR-02**: User can block other users
- **MODR-03**: Admin can view reported content
- **MODR-04**: Admin can remove content
- **MODR-05**: Admin can ban users

## 范围外

| 功能 | 原因 |
|---------|--------|
| 实时聊天 | 复杂度高，不是社区核心价值 |
| 视频帖子 | 存储/带宽成本高，延期到 v2+ |
| OAuth 登录 | 对 v1 来说邮箱/密码已足够 |
| 移动应用 | 先做 Web，移动端以后再说 |

## 可追踪性

| 需求 | 阶段 | 状态 |
|-------------|-------|--------|
| AUTH-01 | 阶段 1 | Pending |
| AUTH-02 | 阶段 1 | Pending |
| AUTH-03 | 阶段 1 | Pending |
| AUTH-04 | 阶段 1 | Pending |
| PROF-01 | 阶段 2 | Pending |
| PROF-02 | 阶段 2 | Pending |
| PROF-03 | 阶段 2 | Pending |
| PROF-04 | 阶段 2 | Pending |
| CONT-01 | 阶段 3 | Pending |
| CONT-02 | 阶段 3 | Pending |
| CONT-03 | 阶段 3 | Pending |
| CONT-04 | 阶段 3 | Pending |
| CONT-05 | 阶段 3 | Pending |
| SOCL-01 | 阶段 4 | Pending |
| SOCL-02 | 阶段 4 | Pending |
| SOCL-03 | 阶段 4 | Pending |
| SOCL-04 | 阶段 4 | Pending |
| SOCL-05 | 阶段 4 | Pending |

**覆盖情况：**
- v1 需求总数：18
- 已映射到阶段：18
- 未映射：0 ✓

---
*需求定义时间：2025-01-14*
*最后更新：2025-01-14，更新时机：初始定义后*
```

</example>
