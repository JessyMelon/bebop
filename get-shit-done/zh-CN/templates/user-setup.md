# 用户设置模板

用于 `.planning/phases/XX-name/{phase}-USER-SETUP.md` 的模板 - 需要人工完成、Claude 无法自动化的配置。

**Purpose:** 记录那些确实需要人手操作的设置任务 - 账号创建、控制台配置、secret 获取。Claude 会自动完成所有可自动化的部分；这个文件只记录剩余内容。

---

## 文件模板

```markdown
# Phase {X}: 需要用户设置

**Generated:** [YYYY-MM-DD]
**Phase:** {phase-name}
**Status:** Incomplete

请完成以下事项以使集成正常工作。Claude 已自动完成所有可自动化的部分；这些项目需要人工访问外部控制台或账号。

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `ENV_VAR_NAME` | [Service Dashboard → Path → To → Value] | `.env.local` |
| [ ] | `ANOTHER_VAR` | [Service Dashboard → Path → To → Value] | `.env.local` |

## Account Setup

[仅当需要新建账号时]

- [ ] **Create [Service] account**
  - URL: [signup URL]
  - Skip if: Already have account

## Dashboard Configuration

[仅当需要控制台配置时]

- [ ] **[Configuration task]**
  - Location: [Service Dashboard → Path → To → Setting]
  - Set to: [所需值或配置]
  - Notes: [任何重要说明]

## Verification

完成设置后，使用以下命令验证：

```bash
# [Verification commands]
```

预期结果：
- [成功时应看到什么]

---

**全部完成后：** 将文件顶部的 status 标记为 "Complete"。
```

---

## 何时生成

当 plan frontmatter 包含 `user_setup` 字段时，生成 `{phase}-USER-SETUP.md`。

**Trigger:** PLAN.md 的 frontmatter 中存在 `user_setup`，且其中有内容。

**Location:** 与 PLAN.md 和 SUMMARY.md 位于同一目录。

**Timing:** 在 execute-plan.md 中，task 完成后、创建 SUMMARY.md 前生成。

---

## Frontmatter Schema

在 PLAN.md 中，`user_setup` 用于声明需要人工完成的配置：

```yaml
user_setup:
  - service: stripe
    why: "Payment processing requires API keys"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard → Developers → API keys → Secret key"
      - name: STRIPE_WEBHOOK_SECRET
        source: "Stripe Dashboard → Developers → Webhooks → Signing secret"
    dashboard_config:
      - task: "Create webhook endpoint"
        location: "Stripe Dashboard → Developers → Webhooks → Add endpoint"
        details: "URL: https://[your-domain]/api/webhooks/stripe, Events: checkout.session.completed, customer.subscription.*"
    local_dev:
      - "Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe"
      - "Use the webhook secret from CLI output for local testing"
```

---

## 自动化优先规则

**USER-SETUP.md 只包含 Claude 确实做不了的事情。**

| Claude CAN Do (not in USER-SETUP) | Claude CANNOT Do (→ USER-SETUP) |
|-----------------------------------|--------------------------------|
| `npm install stripe` | Create Stripe account |
| 编写 webhook handler 代码 | 从控制台获取 API keys |
| 创建 `.env.local` 文件结构 | 填入真实 secret 值 |
| 运行 `stripe listen` | 完成 Stripe CLI 认证（浏览器 OAuth） |
| 配置 package.json | 访问外部服务控制台 |
| 编写任何代码 | 从第三方系统取回 secrets |

**判断标准：** “这件事是否要求一个人在浏览器里操作，且访问 Claude 没有凭据的账号？”
- 是 → USER-SETUP.md
- 否 → Claude 自动完成

---

## 按服务分类的示例

<stripe_example>
```markdown
# Phase 10: 需要用户设置

**Generated:** 2025-01-14
**Phase:** 10-monetization
**Status:** Incomplete

请完成以下事项以使 Stripe 集成正常工作。

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key | `.env.local` |
| [ ] | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → Publishable key | `.env.local` |
| [ ] | `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → [endpoint] → Signing secret | `.env.local` |

## Account Setup

- [ ] **Create Stripe account** (if needed)
  - URL: https://dashboard.stripe.com/register
  - Skip if: Already have Stripe account

## Dashboard Configuration

- [ ] **Create webhook endpoint**
  - Location: Stripe Dashboard → Developers → Webhooks → Add endpoint
  - Endpoint URL: `https://[your-domain]/api/webhooks/stripe`
  - Events to send:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`

- [ ] **Create products and prices** (if using subscription tiers)
  - Location: Stripe Dashboard → Products → Add product
  - Create each subscription tier
  - Copy Price IDs to:
    - `STRIPE_STARTER_PRICE_ID`
    - `STRIPE_PRO_PRICE_ID`

## Local Development

用于本地 webhook 测试：
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
使用 CLI 输出中的 webhook signing secret（以 `whsec_` 开头）。

## Verification

完成设置后：

```bash
# 检查 env vars 是否已设置
grep STRIPE .env.local

# 验证 build 通过
npm run build

# 测试 webhook endpoint（应返回 400 bad signature，而不是 500 crash）
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{}'
```

预期：Build 通过，webhook 返回 400（说明签名校验正常工作）。

---

**全部完成后：** 将文件顶部的 status 标记为 "Complete"。
```
</stripe_example>

<supabase_example>
```markdown
# Phase 2: 需要用户设置

**Generated:** 2025-01-14
**Phase:** 02-authentication
**Status:** Incomplete

请完成以下事项以使 Supabase Auth 正常工作。

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | `.env.local` |
| [ ] | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public | `.env.local` |
| [ ] | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role | `.env.local` |

## Account Setup

- [ ] **Create Supabase project**
  - URL: https://supabase.com/dashboard/new
  - Skip if: 已经有该应用对应的 project

## Dashboard Configuration

- [ ] **Enable Email Auth**
  - Location: Supabase Dashboard → Authentication → Providers
  - Enable: Email provider
  - Configure: Confirm email（按偏好开启或关闭）

- [ ] **Configure OAuth providers** (if using social login)
  - Location: Supabase Dashboard → Authentication → Providers
  - For Google: Add Client ID and Secret from Google Cloud Console
  - For GitHub: Add Client ID and Secret from GitHub OAuth Apps

## Verification

完成设置后：

```bash
# 检查 env vars
grep SUPABASE .env.local

# 验证连接（在项目目录运行）
npx supabase status
```

---

**全部完成后：** 将文件顶部的 status 标记为 "Complete"。
```
</supabase_example>

<sendgrid_example>
```markdown
# Phase 5: 需要用户设置

**Generated:** 2025-01-14
**Phase:** 05-notifications
**Status:** Incomplete

请完成以下事项以使 SendGrid 邮件功能正常工作。

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `SENDGRID_API_KEY` | SendGrid Dashboard → Settings → API Keys → Create API Key | `.env.local` |
| [ ] | `SENDGRID_FROM_EMAIL` | 你已验证的发件人邮箱地址 | `.env.local` |

## Account Setup

- [ ] **Create SendGrid account**
  - URL: https://signup.sendgrid.com/
  - Skip if: Already have account

## Dashboard Configuration

- [ ] **Verify sender identity**
  - Location: SendGrid Dashboard → Settings → Sender Authentication
  - Option 1: Single Sender Verification（快捷，适合开发）
  - Option 2: Domain Authentication（生产环境）

- [ ] **Create API Key**
  - Location: SendGrid Dashboard → Settings → API Keys → Create API Key
  - Permission: Restricted Access → Mail Send (Full Access)
  - 创建后立即复制 key（只显示一次）

## Verification

完成设置后：

```bash
# 检查 env var
grep SENDGRID .env.local

# 测试邮件发送（替换为你的测试邮箱）
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your@email.com"}'
```

---

**全部完成后：** 将文件顶部的 status 标记为 "Complete"。
```
</sendgrid_example>

---

## 指南

**绝不要包含：** 真实 secret 值，或 Claude 能自动完成的步骤（如安装包、改代码）。

**Naming:** `{phase}-USER-SETUP.md` 要匹配阶段编号模式。
**Status tracking:** 用户在完成后勾选复选框，并更新 status 行。
**Searchability:** `grep -r "USER-SETUP" .planning/` 可找出所有包含用户要求的 phase。
