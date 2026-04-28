<overview>
计划会自主执行。检查点将需要人工验证或决策的交互点规范化。

**Core principle:** Claude 用 CLI/API 自动化一切。检查点用于验证和决策，不是用于手工工作。

**Golden rules:**
1. **If Claude can run it, Claude runs it** - 绝不要让用户执行 CLI 命令、启动服务器或运行构建
2. **Claude sets up the verification environment** - 启动开发服务器、填充数据库、配置环境变量
3. **User only does what requires human judgment** - 视觉检查、UX 评估、“这样感觉对吗？”
4. **Secrets come from user, automation comes from Claude** - 向用户索取 API keys，然后由 Claude 通过 CLI 使用它们
5. **Auto-mode bypasses verification/decision checkpoints** — 当 config 中 `workflow._auto_chain_active` 或 `workflow.auto_advance` 为 true 时：human-verify 自动通过、decision 自动选择第一个选项、human-action 仍然停止（auth gates 无法自动化）
</overview>

<checkpoint_types>

<type name="human-verify">
## checkpoint:human-verify (Most Common - 90%)

**When:** Claude 已完成自动化工作，由人工确认结果是否正确。

**Use for:**
- 可视化 UI 检查（布局、样式、响应式）
- 交互流程（点击向导、测试用户流程）
- 功能验证（功能是否按预期工作）
- 音频/视频播放质量
- 动画流畅度
- 无障碍测试

**Structure:**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What Claude automated and deployed/built]</what-built>
  <how-to-verify>
    [Exact steps to test - URLs, commands, expected behavior]
  </how-to-verify>
  <resume-signal>[How to continue - "approved", "yes", or describe issues]</resume-signal>
</task>
```

**Example: UI Component (shows key pattern: Claude starts server BEFORE checkpoint)**
```xml
<task type="auto">
  <name>Build responsive dashboard layout</name>
  <files>src/components/Dashboard.tsx, src/app/dashboard/page.tsx</files>
  <action>Create dashboard with sidebar, header, and content area. Use Tailwind responsive classes for mobile.</action>
  <verify>npm run build succeeds, no TypeScript errors</verify>
  <done>Dashboard component builds without errors</done>
</task>

<task type="auto">
  <name>Start dev server for verification</name>
  <action>Run `npm run dev` in background, wait for "ready" message, capture port</action>
  <verify>fetch http://localhost:3000 returns 200</verify>
  <done>Dev server running at http://localhost:3000</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Responsive dashboard layout - dev server running at http://localhost:3000</what-built>
  <how-to-verify>
    Visit http://localhost:3000/dashboard and verify:
    1. Desktop (>1024px): Sidebar left, content right, header top
    2. Tablet (768px): Sidebar collapses to hamburger menu
    3. Mobile (375px): Single column layout, bottom nav appears
    4. No layout shift or horizontal scroll at any size
  </how-to-verify>
  <resume-signal>Type "approved" or describe layout issues</resume-signal>
</task>
```

**Example: Xcode Build**
```xml
<task type="auto">
  <name>Build macOS app with Xcode</name>
  <files>App.xcodeproj, Sources/</files>
  <action>Run `xcodebuild -project App.xcodeproj -scheme App build`. Check for compilation errors in output.</action>
  <verify>Build output contains "BUILD SUCCEEDED", no errors</verify>
  <done>App builds successfully</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Built macOS app at DerivedData/Build/Products/Debug/App.app</what-built>
  <how-to-verify>
    Open App.app and test:
    - App launches without crashes
    - Menu bar icon appears
    - Preferences window opens correctly
    - No visual glitches or layout issues
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```
</type>

<type name="decision">
## checkpoint:decision (9%)

**When:** 需要人工做出会影响实现方向的选择。

**Use for:**
- 技术选型（选择哪个 auth provider、哪个 database）
- 架构决策（monorepo 还是独立 repos）
- 设计选择（配色方案、布局方式）
- 功能优先级（先做哪个 variant）
- 数据模型决策（schema 结构）

**Structure:**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[What's being decided]</decision>
  <context>[Why this decision matters]</context>
  <options>
    <option id="option-a">
      <name>[Option name]</name>
      <pros>[Benefits]</pros>
      <cons>[Tradeoffs]</cons>
    </option>
    <option id="option-b">
      <name>[Option name]</name>
      <pros>[Benefits]</pros>
      <cons>[Tradeoffs]</cons>
    </option>
  </options>
  <resume-signal>[How to indicate choice]</resume-signal>
</task>
```

**Example: Auth Provider Selection**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>Select authentication provider</decision>
  <context>
    Need user authentication for the app. Three solid options with different tradeoffs.
  </context>
  <options>
    <option id="supabase">
      <name>Supabase Auth</name>
      <pros>Built-in with Supabase DB we're using, generous free tier, row-level security integration</pros>
      <cons>Less customizable UI, tied to Supabase ecosystem</cons>
    </option>
    <option id="clerk">
      <name>Clerk</name>
      <pros>Beautiful pre-built UI, best developer experience, excellent docs</pros>
      <cons>Paid after 10k MAU, vendor lock-in</cons>
    </option>
    <option id="nextauth">
      <name>NextAuth.js</name>
      <pros>Free, self-hosted, maximum control, widely adopted</pros>
      <cons>More setup work, you manage security updates, UI is DIY</cons>
    </option>
  </options>
  <resume-signal>Select: supabase, clerk, or nextauth</resume-signal>
</task>
```

**Example: Database Selection**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>Select database for user data</decision>
  <context>
    App needs persistent storage for users, sessions, and user-generated content.
    Expected scale: 10k users, 1M records first year.
  </context>
  <options>
    <option id="supabase">
      <name>Supabase (Postgres)</name>
      <pros>Full SQL, generous free tier, built-in auth, real-time subscriptions</pros>
      <cons>Vendor lock-in for real-time features, less flexible than raw Postgres</cons>
    </option>
    <option id="planetscale">
      <name>PlanetScale (MySQL)</name>
      <pros>Serverless scaling, branching workflow, excellent DX</pros>
      <cons>MySQL not Postgres, no foreign keys in free tier</cons>
    </option>
    <option id="convex">
      <name>Convex</name>
      <pros>Real-time by default, TypeScript-native, automatic caching</pros>
      <cons>Newer platform, different mental model, less SQL flexibility</cons>
    </option>
  </options>
  <resume-signal>Select: supabase, planetscale, or convex</resume-signal>
</task>
```
</type>

<type name="human-action">
## checkpoint:human-action (1% - Rare)

**When:** 操作没有 CLI/API 且必须由人工交互完成，或者 Claude 在自动化过程中遇到了认证门槛。

**Use ONLY for:**
- **Authentication gates** - Claude 已尝试 CLI/API，但需要凭据（这不是失败）
- 邮件验证链接（点邮件）
- 短信 2FA 验证码（手机验证）
- 手动账号审批（平台要求人工审核）
- 信用卡 3D Secure 流程（基于 Web 的支付授权）
- OAuth 应用审批（基于 Web 的批准）

**Do NOT use for pre-planned manual work:**
- 部署（使用 CLI - 如需则走 auth gate）
- 创建 webhooks/databases（使用 API/CLI - 如需则走 auth gate）
- 运行 builds/tests（使用 Bash tool）
- 创建文件（使用 Write tool）

**Structure:**
```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>[What human must do - Claude already did everything automatable]</action>
  <instructions>
    [What Claude already automated]
    [The ONE thing requiring human action]
  </instructions>
  <verification>[What Claude can check afterward]</verification>
  <resume-signal>[How to continue]</resume-signal>
</task>
```

**Example: Email Verification**
```xml
<task type="auto">
  <name>Create SendGrid account via API</name>
  <action>Use SendGrid API to create subuser account with provided email. Request verification email.</action>
  <verify>API returns 201, account created</verify>
  <done>Account created, verification email sent</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <action>Complete email verification for SendGrid account</action>
  <instructions>
    I created the account and requested verification email.
    Check your inbox for SendGrid verification link and click it.
  </instructions>
  <verification>SendGrid API key works: curl test succeeds</verification>
  <resume-signal>Type "done" when email verified</resume-signal>
</task>
```

**Example: Authentication Gate (Dynamic Checkpoint)**
```xml
<task type="auto">
  <name>Deploy to Vercel</name>
  <files>.vercel/, vercel.json</files>
  <action>Run `vercel --yes` to deploy</action>
  <verify>vercel ls shows deployment, fetch returns 200</verify>
</task>

<!-- If vercel returns "Error: Not authenticated", Claude creates checkpoint on the fly -->

<task type="checkpoint:human-action" gate="blocking">
  <action>Authenticate Vercel CLI so I can continue deployment</action>
  <instructions>
    I tried to deploy but got authentication error.
    Run: vercel login
    This will open your browser - complete the authentication flow.
  </instructions>
  <verification>vercel whoami returns your account email</verification>
  <resume-signal>Type "done" when authenticated</resume-signal>
</task>

<!-- After authentication, Claude retries the deployment -->

<task type="auto">
  <name>Retry Vercel deployment</name>
  <action>Run `vercel --yes` (now authenticated)</action>
  <verify>vercel ls shows deployment, fetch returns 200</verify>
</task>
```

**Key distinction:** Auth gates 是 Claude 遇到 auth error 时动态创建的。不是预先规划的 —— Claude 先尝试自动化，只有被阻塞时才请求凭据。
</type>
</checkpoint_types>

<execution_protocol>

当 Claude 遇到 `type="checkpoint:*"` 时：

1. **立即停止** - 不要继续下一个任务
2. **清晰展示检查点**，使用下面的格式
3. **等待用户响应** - 不要臆造完成状态
4. **如可验证则验证** - 检查文件、运行测试，按要求执行
5. **恢复执行** - 只有确认后才能继续下一个任务

**For checkpoint:human-verify:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                    ║
╚═══════════════════════════════════════════════════════╝

Progress: 5/8 tasks complete
Task: Responsive dashboard layout

Built: Responsive dashboard at /dashboard

How to verify:
  1. Visit: http://localhost:3000/dashboard
  2. Desktop (>1024px): Sidebar visible, content fills remaining space
  3. Tablet (768px): Sidebar collapses to icons
  4. Mobile (375px): Sidebar hidden, hamburger menu appears

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
```

**For checkpoint:decision:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                        ║
╚═══════════════════════════════════════════════════════╝

Progress: 2/6 tasks complete
Task: Select authentication provider

Decision: Which auth provider should we use?

Context: Need user authentication. Three options with different tradeoffs.

Options:
  1. supabase - Built-in with our DB, free tier
     Pros: Row-level security integration, generous free tier
     Cons: Less customizable UI, ecosystem lock-in

  2. clerk - Best DX, paid after 10k users
     Pros: Beautiful pre-built UI, excellent documentation
     Cons: Vendor lock-in, pricing at scale

  3. nextauth - Self-hosted, maximum control
     Pros: Free, no vendor lock-in, widely adopted
     Cons: More setup work, DIY security updates

────────────────────────────────────────────────────────
→ YOUR ACTION: Select supabase, clerk, or nextauth
────────────────────────────────────────────────────────
```

**For checkpoint:human-action:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: 3/8 tasks complete
Task: Deploy to Vercel

Attempted: vercel --yes
Error: Not authenticated. Please run 'vercel login'

What you need to do:
  1. Run: vercel login
  2. Complete browser authentication when it opens
  3. Return here when done

I'll verify: vercel whoami returns your account

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when authenticated
────────────────────────────────────────────────────────
```
</execution_protocol>

<authentication_gates>

**Auth gate = Claude tried CLI/API, got auth error.** 这不是失败，而是需要人工输入来解除阻塞的门槛。

**Pattern:** Claude 尝试自动化 → auth error → 创建 checkpoint:human-action → 用户完成认证 → Claude 重试 → 继续执行

**Gate protocol:**
1. 识别出这不是失败 - 缺少认证是预期情况
2. 停止当前任务 - 不要反复重试
3. 动态创建 checkpoint:human-action
4. 提供精确的认证步骤
5. 验证认证已生效
6. 重试原任务
7. 正常继续

**Key distinction:**
- 预先规划的检查点：“我需要你做 X”（错误 - Claude 应自动化）
- Auth gate：“我尝试自动化 X，但需要凭据”（正确 - 用于解除自动化阻塞）

</authentication_gates>

<automation_reference>

**The rule:** 只要有 CLI/API，Claude 就执行。绝不让人工去做本可自动化的工作。

## Service CLI Reference

| Service | CLI/API | Key Commands | Auth Gate |
|---------|---------|--------------|-----------|
| Vercel | `vercel` | `--yes`, `env add`, `--prod`, `ls` | `vercel login` |
| Railway | `railway` | `init`, `up`, `variables set` | `railway login` |
| Fly | `fly` | `launch`, `deploy`, `secrets set` | `fly auth login` |
| Stripe | `stripe` + API | `listen`, `trigger`, API calls | API key in .env |
| Supabase | `supabase` | `init`, `link`, `db push`, `gen types` | `supabase login` |
| Upstash | `upstash` | `redis create`, `redis get` | `upstash auth login` |
| PlanetScale | `pscale` | `database create`, `branch create` | `pscale auth login` |
| GitHub | `gh` | `repo create`, `pr create`, `secret set` | `gh auth login` |
| Node | `npm`/`pnpm` | `install`, `run build`, `test`, `run dev` | N/A |
| Xcode | `xcodebuild` | `-project`, `-scheme`, `build`, `test` | N/A |
| Convex | `npx convex` | `dev`, `deploy`, `env set`, `env get` | `npx convex login` |

## Environment Variable Automation

**Env files:** 使用 Write/Edit tools。绝不要让人工手动创建 `.env`。

**Dashboard env vars via CLI:**

| Platform | CLI Command | Example |
|----------|-------------|---------|
| Convex | `npx convex env set` | `npx convex env set OPENAI_API_KEY sk-...` |
| Vercel | `vercel env add` | `vercel env add STRIPE_KEY production` |
| Railway | `railway variables set` | `railway variables set API_KEY=value` |
| Fly | `fly secrets set` | `fly secrets set DATABASE_URL=...` |
| Supabase | `supabase secrets set` | `supabase secrets set MY_SECRET=value` |

**Secret collection pattern:**
```xml
<!-- WRONG: Asking user to add env vars in dashboard -->
<task type="checkpoint:human-action">
  <action>Add OPENAI_API_KEY to Convex dashboard</action>
  <instructions>Go to dashboard.convex.dev → Settings → Environment Variables → Add</instructions>
</task>

<!-- RIGHT: Claude asks for value, then adds via CLI -->
<task type="checkpoint:human-action">
  <action>Provide your OpenAI API key</action>
  <instructions>
    I need your OpenAI API key for Convex backend.
    Get it from: https://platform.openai.com/api-keys
    Paste the key (starts with sk-)
  </instructions>
  <verification>I'll add it via `npx convex env set` and verify</verification>
  <resume-signal>Paste your API key</resume-signal>
</task>

<task type="auto">
  <name>Configure OpenAI key in Convex</name>
  <action>Run `npx convex env set OPENAI_API_KEY {user-provided-key}`</action>
  <verify>`npx convex env get OPENAI_API_KEY` returns the key (masked)</verify>
</task>
```

## Dev Server Automation

| Framework | Start Command | Ready Signal | Default URL |
|-----------|---------------|--------------|-------------|
| Next.js | `npm run dev` | "Ready in" or "started server" | http://localhost:3000 |
| Vite | `npm run dev` | "ready in" | http://localhost:5173 |
| Convex | `npx convex dev` | "Convex functions ready" | N/A (backend only) |
| Express | `npm start` | "listening on port" | http://localhost:3000 |
| Django | `python manage.py runserver` | "Starting development server" | http://localhost:8000 |

**Server lifecycle:**
```bash
# Run in background, capture PID
npm run dev &
DEV_SERVER_PID=$!

# Wait for ready (max 30s) — uses fetch() for cross-platform compatibility
timeout 30 bash -c 'until node -e "fetch(\"http://localhost:3000\").then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))" 2>/dev/null; do sleep 1; done'
```

**Port conflicts:** 杀掉陈旧进程（`lsof -ti:3000 | xargs kill`）或使用备用端口（`--port 3001`）。

**Server stays running** 贯穿各个检查点。只有在计划完成、切换到生产环境或端口需要给其他服务使用时才结束它。

## CLI Installation Handling

| CLI | Auto-install? | Command |
|-----|---------------|---------|
| npm/pnpm/yarn | No - ask user | User chooses package manager |
| vercel | Yes | `npm i -g vercel` |
| gh (GitHub) | Yes | `brew install gh` (macOS) or `apt install gh` (Linux) |
| stripe | Yes | `npm i -g stripe` |
| supabase | Yes | `npm i -g supabase` |
| convex | No - use npx | `npx convex` (no install needed) |
| fly | Yes | `brew install flyctl` or curl installer |
| railway | Yes | `npm i -g @railway/cli` |

**Protocol:** 尝试命令 → “command not found” → 是否可自动安装？→ 可以：静默安装并重试 → 不行：创建检查点让用户安装。

## Pre-Checkpoint Automation Failures

| Failure | Response |
|---------|----------|
| Server won't start | 检查错误、修复问题、重试（不要进入检查点） |
| Port in use | 杀掉陈旧进程或使用备用端口 |
| Missing dependency | 运行 `npm install`，然后重试 |
| Build error | 先修复错误（这是 bug，不是检查点问题） |
| Auth error | 创建 auth gate checkpoint |
| Network timeout | 带退避重试，若持续存在再进入检查点 |

**Never present a checkpoint with broken verification environment.** 如果本地服务器没有响应，就不要让用户去“访问 localhost:3000”。

> **Cross-platform note:** 用 `node -e "fetch('http://localhost:3000').then(r=>console.log(r.status))"` 代替 `curl` 做健康检查。`curl` 在 Windows MSYS/Git Bash 下会因 SSL/path mangling 问题失效。

```xml
<!-- WRONG: Checkpoint with broken environment -->
<task type="checkpoint:human-verify">
  <what-built>Dashboard (server failed to start)</what-built>
  <how-to-verify>Visit http://localhost:3000...</how-to-verify>
</task>

<!-- RIGHT: Fix first, then checkpoint -->
<task type="auto">
  <name>Fix server startup issue</name>
  <action>Investigate error, fix root cause, restart server</action>
  <verify>fetch http://localhost:3000 returns 200</verify>
</task>

<task type="checkpoint:human-verify">
  <what-built>Dashboard - server running at http://localhost:3000</what-built>
  <how-to-verify>Visit http://localhost:3000/dashboard...</how-to-verify>
</task>
```

## Automatable Quick Reference

| Action | Automatable? | Claude does it? |
|--------|--------------|-----------------|
| Deploy to Vercel | Yes (`vercel`) | YES |
| Create Stripe webhook | Yes (API) | YES |
| Write .env file | Yes (Write tool) | YES |
| Create Upstash DB | Yes (`upstash`) | YES |
| Run tests | Yes (`npm test`) | YES |
| Start dev server | Yes (`npm run dev`) | YES |
| Add env vars to Convex | Yes (`npx convex env set`) | YES |
| Add env vars to Vercel | Yes (`vercel env add`) | YES |
| Seed database | Yes (CLI/API) | YES |
| Click email verification link | No | NO |
| Enter credit card with 3DS | No | NO |
| Complete OAuth in browser | No | NO |
| Visually verify UI looks correct | No | NO |
| Test interactive user flows | No | NO |

</automation_reference>

<writing_guidelines>

**DO:**
- 在进入检查点前先用 CLI/API 自动化一切
- 说具体：写 “Visit https://myapp.vercel.app”，不要写 “check deployment”
- 给验证步骤编号
- 写明预期结果：`You should see X`
- 提供上下文：说明为什么存在这个检查点

**DON'T:**
- 让人工去做 Claude 能自动化的工作 ❌
- 预设对方知道细节：`Configure the usual settings` ❌
- 跳过步骤：`Set up database`（太模糊）❌
- 在一个检查点里混合多种验证 ❌

**Placement:**
- **After automation completes** - 不是在 Claude 干活之前
- **After UI buildout** - 在宣布阶段完成之前
- **Before dependent work** - 决策先于实现
- **At integration points** - 配置外部服务之后

**Bad placement:** 在自动化之前 ❌ | 过于频繁 ❌ | 太晚（依赖任务已经需要结果）❌
</writing_guidelines>

<examples>

### Example 1: Database Setup (No Checkpoint Needed)

```xml
<task type="auto">
  <name>Create Upstash Redis database</name>
  <files>.env</files>
  <action>
    1. Run `upstash redis create myapp-cache --region us-east-1`
    2. Capture connection URL from output
    3. Write to .env: UPSTASH_REDIS_URL={url}
    4. Verify connection with test command
  </action>
  <verify>
    - upstash redis list shows database
    - .env contains UPSTASH_REDIS_URL
    - Test connection succeeds
  </verify>
  <done>Redis database created and configured</done>
</task>

<!-- NO CHECKPOINT NEEDED - Claude automated everything and verified programmatically -->
```

### Example 2: Full Auth Flow (Single checkpoint at end)

```xml
<task type="auto">
  <name>Create user schema</name>
  <files>src/db/schema.ts</files>
  <action>Define User, Session, Account tables with Drizzle ORM</action>
  <verify>npm run db:generate succeeds</verify>
</task>

<task type="auto">
  <name>Create auth API routes</name>
  <files>src/app/api/auth/[...nextauth]/route.ts</files>
  <action>Set up NextAuth with GitHub provider, JWT strategy</action>
  <verify>TypeScript compiles, no errors</verify>
</task>

<task type="auto">
  <name>Create login UI</name>
  <files>src/app/login/page.tsx, src/components/LoginButton.tsx</files>
  <action>Create login page with GitHub OAuth button</action>
  <verify>npm run build succeeds</verify>
</task>

<task type="auto">
  <name>Start dev server for auth testing</name>
  <action>Run `npm run dev` in background, wait for ready signal</action>
  <verify>fetch http://localhost:3000 returns 200</verify>
  <done>Dev server running at http://localhost:3000</done>
</task>

<!-- ONE checkpoint at end verifies the complete flow -->
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete authentication flow - dev server running at http://localhost:3000</what-built>
  <how-to-verify>
    1. Visit: http://localhost:3000/login
    2. Click "Sign in with GitHub"
    3. Complete GitHub OAuth flow
    4. Verify: Redirected to /dashboard, user name displayed
    5. Refresh page: Session persists
    6. Click logout: Session cleared
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```
</examples>

<anti_patterns>

### ❌ BAD: Asking user to start dev server

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard component</what-built>
  <how-to-verify>
    1. Run: npm run dev
    2. Visit: http://localhost:3000/dashboard
    3. Check layout is correct
  </how-to-verify>
</task>
```

**Why bad:** Claude 可以运行 `npm run dev`。用户应该只访问 URL，而不是执行命令。

### ✅ GOOD: Claude starts server, user visits

```xml
<task type="auto">
  <name>Start dev server</name>
  <action>Run `npm run dev` in background</action>
  <verify>fetch http://localhost:3000 returns 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard at http://localhost:3000/dashboard (server running)</what-built>
  <how-to-verify>
    Visit http://localhost:3000/dashboard and verify:
    1. Layout matches design
    2. No console errors
  </how-to-verify>
</task>
```

### ❌ BAD: Asking human to deploy / ✅ GOOD: Claude automates

```xml
<!-- BAD: Asking user to deploy via dashboard -->
<task type="checkpoint:human-action" gate="blocking">
  <action>Deploy to Vercel</action>
  <instructions>Visit vercel.com/new → Import repo → Click Deploy → Copy URL</instructions>
</task>

<!-- GOOD: Claude deploys, user verifies -->
<task type="auto">
  <name>Deploy to Vercel</name>
  <action>Run `vercel --yes`. Capture URL.</action>
  <verify>vercel ls shows deployment, fetch returns 200</verify>
</task>

<task type="checkpoint:human-verify">
  <what-built>Deployed to {url}</what-built>
  <how-to-verify>Visit {url}, check homepage loads</how-to-verify>
  <resume-signal>Type "approved"</resume-signal>
</task>
```

### ❌ BAD: Too many checkpoints / ✅ GOOD: Single checkpoint

```xml
<!-- BAD: Checkpoint after every task -->
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API route</task>
<task type="checkpoint:human-verify">Check API</task>
<task type="auto">Create UI form</task>
<task type="checkpoint:human-verify">Check form</task>

<!-- GOOD: One checkpoint at end -->
<task type="auto">Create schema</task>
<task type="auto">Create API route</task>
<task type="auto">Create UI form</task>

<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
  <resume-signal>Type "approved"</resume-signal>
</task>
```

### ❌ BAD: Vague verification / ✅ GOOD: Specific steps

```xml
<!-- BAD -->
<task type="checkpoint:human-verify">
  <what-built>Dashboard</what-built>
  <how-to-verify>Check it works</how-to-verify>
</task>

<!-- GOOD -->
<task type="checkpoint:human-verify">
  <what-built>Responsive dashboard - server running at http://localhost:3000</what-built>
  <how-to-verify>
    Visit http://localhost:3000/dashboard and verify:
    1. Desktop (>1024px): Sidebar visible, content area fills remaining space
    2. Tablet (768px): Sidebar collapses to icons
    3. Mobile (375px): Sidebar hidden, hamburger menu in header
    4. No horizontal scroll at any size
  </how-to-verify>
  <resume-signal>Type "approved" or describe layout issues</resume-signal>
</task>
```

### ❌ BAD: Asking user to run CLI commands

```xml
<task type="checkpoint:human-action">
  <action>Run database migrations</action>
  <instructions>Run: npx prisma migrate deploy && npx prisma db seed</instructions>
</task>
```

**Why bad:** Claude 可以运行这些命令。用户绝不应该执行 CLI 命令。

### ❌ BAD: Asking user to copy values between services

```xml
<task type="checkpoint:human-action">
  <action>Configure webhook URL in Stripe</action>
  <instructions>Copy deployment URL → Stripe Dashboard → Webhooks → Add endpoint → Copy secret → Add to .env</instructions>
</task>
```

**Why bad:** Stripe 有 API。Claude 应通过 API 创建 webhook，并直接写入 `.env`。

</anti_patterns>

<type name="tdd-review">
## checkpoint:tdd-review (TDD Mode Only)

**When:** 一个阶段内所有 waves 都完成，且启用了 `workflow.tdd_mode`。由 execute-phase orchestrator 在 `aggregate_results` 之后插入。

**Purpose:** 对该阶段内所有 `type: tdd` plans 的 TDD gate 合规性进行协作审查。属于 advisory —— 不阻塞执行。

**Use for:**
- 验证每个 TDD plan 的 RED/GREEN/REFACTOR commit 顺序
- 暴露 gate 违规（缺少 RED 或 GREEN commits）
- 审查测试质量（测试是否因正确原因失败）
- 确认 GREEN 实现保持最小化

**Structure:**
```xml
<task type="checkpoint:tdd-review" gate="advisory">
  <what-checked>TDD gate compliance for {count} plans in Phase {X}</what-checked>
  <gate-results>
    | Plan | RED | GREEN | REFACTOR | Status |
    |------|-----|-------|----------|--------|
    | {id} |  ✓  |   ✓   |    ✓     | Pass   |
  </gate-results>
  <violations>[List of gate violations, or "None"]</violations>
  <resume-signal>Review complete — proceed to phase verification</resume-signal>
</task>
```

**Auto-mode behavior:** 当 `workflow._auto_chain_active` 或 `workflow.auto_advance` 为 true 时，TDD review checkpoint 会自动通过（advisory gate —— 永不阻塞）。
</type>

<summary>

检查点用于将 verification 和 decision 中的人在环节点规范化，而不是让人手工工作。

**The golden rule:** 只要 Claude 能自动化，Claude 就必须自动化。

**Checkpoint priority:**
1. **checkpoint:human-verify** (90%) - Claude 自动化一切，由人工确认视觉/功能正确性
2. **checkpoint:decision** (9%) - 人工做出架构/技术选择
3. **checkpoint:human-action** (1%) - 真正不可避免、没有 API/CLI 的手工步骤

**When NOT to use checkpoints:**
- Claude 能通过程序验证的事（tests、builds）
- 文件操作（Claude 可以读取文件）
- 代码正确性（tests 和静态分析）
- 任何能通过 CLI/API 自动化的事情
</summary>
