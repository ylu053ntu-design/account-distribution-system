# Railway 部署指南

## 步骤 1：注册 Railway

1. 访问 https://railway.app
2. 点击 "Start a New Project"
3. 使用 GitHub 账号登录

## 步骤 2：创建 GitHub 仓库

1. 在 GitHub 创建新仓库（如 `account-distribution-system`）
2. 将项目代码上传到仓库

```bash
cd /Users/luyiyi_baidu_3/.qianfan/workspace/0933fec104c549da8eb3f7bddff1ecfb/account-distribution-system

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/account-distribution-system.git
git push -u origin main
```

## 步骤 3：在 Railway 创建项目

1. 在 Railway 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择你的仓库
4. 点击 "Deploy Now"

## 步骤 4：添加 PostgreSQL 数据库

1. 在项目中点击 "+ New"
2. 选择 "Database" → "PostgreSQL"
3. 数据库会自动创建

## 步骤 5：设置环境变量

在 Railway 项目中，点击你的服务 → "Variables"，添加以下变量：

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ylu053ntu@gmail.com
SMTP_PASS=kgffmiqnhssgfgfe
ADMIN_PASSWORD=Lyy144003554!
```

**注意**：`DATABASE_URL` 使用 `${{Postgres.DATABASE_URL}}` 会自动引用 PostgreSQL 数据库的连接字符串。

## 步骤 6：添加测试账户

部署成功后，使用 API 添加账户：

```bash
curl -X POST https://你的域名.railway.app/api/admin/accounts \
  -H "Content-Type: application/json" \
  -H "x-admin-password: Lyy144003554!" \
  -d '{
    "accounts": [
      {"username": "BaiduCloudSG041", "password": "Baiducloud847293"},
      {"username": "BaiduCloudSG042", "password": "Baiducloud561847"}
    ]
  }'
```

## 步骤 7：获取访问地址

1. 在 Railway 项目中点击 "Settings"
2. 点击 "Generate Domain"
3. 获得公网地址，如 `https://your-app.railway.app`

## 访问地址

- 用户申请页面：`https://your-app.railway.app`
- 管理后台：`https://your-app.railway.app/admin.html`

## 费用

Railway 提供 $5/月免费额度，足够小型项目使用。

---

## 快速部署命令

如果你想让我帮你准备 GitHub 上传，请告诉我你的 GitHub 用户名。
