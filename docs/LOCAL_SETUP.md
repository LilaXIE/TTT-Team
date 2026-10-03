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

`DEEPSEEK_API_KEY` 为空时，Zev 对话使用本地关键词抽取；配置后才调用 DeepSeek。Key 只放在 `.env.local`，不要提交。

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

## 5. 演示账号

种子数据里的账号是 `alex@demo.hk` / `demo1234`。登录页有「使用演示账号」按钮。

不要把 `.env.local` 和任何 API key 提交到 Git。
