# 本地 Windows 11 启动方式

## 1. 启动 PostgreSQL

项目提供了 Docker Compose：

```powershell
docker compose up -d db
```

默认连接信息：

```text
postgresql://mw:mw@localhost:5432/mandate_wallet
```

如果不用 Docker，请手动安装 PostgreSQL，并在 `.env.local` 中填写 `DATABASE_URL`。

## 2. 配置环境变量

复制模板：

```powershell
Copy-Item .env.local.example .env.local
```

生成密钥：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

至少配置：

- `DATABASE_URL`
- `SESSION_SECRET`
- `TAOBAO_STATE_KEY`
- `SMTP_STATE_KEY`

`DEEPSEEK_API_KEY` 为空时，聊天接口使用本地降级回复；配置后才调用 DeepSeek。

## 3. 迁移和演示数据

```powershell
npm run db:migrate
npm run db:seed
```

演示账号由 `scripts/seed.ts` 输出。

## 4. 启动应用

```powershell
npm run dev
```

打开：

```text
http://localhost:3000
```

## 5. 淘宝首次登录

登录系统后进入首页，点击“首次扫码登录”。服务端会在当前 Windows 电脑打开 Edge。扫码成功后返回网页，登录状态会加密存储到数据库。

不要把以下内容提交到 Git：

- `.env.local`
- `taobao_state.json`
- `edge_user_data/`
- DeepSeek、SMTP、PostgreSQL 密码

如果历史上已经把真实 PostgreSQL 密码提交或发送过，请立即修改该数据库密码并更新 `.env.local`。
