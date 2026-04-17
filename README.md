# 测试账户分发系统

一个简单易用的测试账户分发系统，支持邮箱验证后随机分配账户。

## 功能特点

- 邮箱验证码验证
- 每个邮箱只能领取一次
- 随机分配未使用的账户
- 管理后台查看领取记录
- 支持本地开发和线上部署

## 快速开始

### 1. 安装依赖

```bash
cd account-distribution-system
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3000

# 邮箱SMTP配置（以QQ邮箱为例）
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@qq.com
SMTP_PASS=your-smtp-password

# 管理员密码
ADMIN_PASSWORD=your-admin-password
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 添加测试账户

编辑 `scripts/addAccounts.js` 文件，修改账户数据：

```javascript
// 方式1：直接修改数组
const accounts = [
  { username: 'user1', password: 'pass1' },
  { username: 'user2', password: 'pass2' },
  // ...
];

// 方式2：从CSV文件读取
// 创建 accounts.csv 文件（格式：username,password）
// 脚本会自动读取
```

运行添加账户脚本：

```bash
npm run add-accounts
```

### 5. 启动服务

```bash
npm start
```

访问：
- 用户申请页面：http://localhost:3000
- 管理后台：http://localhost:3000/admin.html

## 部署到 Railway

Railway 是一个简单的云平台，支持 Node.js 和 SQLite。

### 步骤

1. 注册 Railway 账号：https://railway.app

2. 安装 Railway CLI：
```bash
npm install -g @railway/cli
```

3. 登录并创建项目：
```bash
railway login
railway init
```

4. 设置环境变量：
```bash
railway variables set SMTP_HOST=smtp.qq.com
railway variables set SMTP_PORT=587
railway variables set SMTP_USER=your-email@qq.com
railway variables set SMTP_PASS=your-smtp-password
railway variables set ADMIN_PASSWORD=your-admin-password
```

5. 部署：
```bash
railway up
```

6. 获取访问地址：
```bash
railway domain
```

**注意**：Railway 的 SQLite 数据存储在容器的 `/app/data` 目录，容器重启后数据会保留。但如果重新部署，数据会丢失。建议定期备份 `data/accounts.db` 文件。

## 邮箱SMTP配置

### QQ邮箱

1. 登录 QQ邮箱 → 设置 → 账户
2. 开启 POP3/SMTP 服务
3. 生成授权码（不是QQ密码）
4. 配置：
```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@qq.com
SMTP_PASS=授权码
```

### 163邮箱

1. 登录 163邮箱 → 设置 → POP3/SMTP/IMAP
2. 开启 SMTP 服务
3. 设置授权密码
4. 配置：
```env
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@163.com
SMTP_PASS=授权密码
```

### 阿里云邮件推送

1. 开通阿里云邮件推送服务
2. 创建发信地址
3. 配置：
```env
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sender@your-domain.com
SMTP_PASS=SMTP密码
```

## 管理后台

访问 `/admin.html`，输入管理员密码即可查看：

- 账户统计（总数、已分配、剩余）
- 领取记录列表

## API 接口

### 发送验证码

```
POST /api/send-code
Body: { "email": "user@company.com" }
```

### 领取账户

```
POST /api/claim
Body: {
  "name": "张三",
  "company": "测试公司",
  "whatsapp": "+1234567890",
  "email": "user@company.com",
  "code": "123456"
}
```

### 管理接口

需要请求头：`x-admin-password: your-password`

```
GET /api/admin/stats    # 获取统计
GET /api/admin/claims   # 获取领取记录
```

## 数据备份

数据库文件位于 `data/accounts.db`，定期备份此文件即可。

导出领取记录：

```bash
sqlite3 data/accounts.db "SELECT * FROM claims" > claims_backup.csv
```

## 常见问题

### 验证码发送失败

1. 检查 SMTP 配置是否正确
2. 确认邮箱授权码/密码正确
3. 检查邮箱是否开启了 SMTP 服务
4. 查看服务器日志

### 部署后数据库丢失

Railway 等平台重新部署会重置容器，建议：
1. 使用持久化存储卷
2. 定期备份数据库
3. 或使用云数据库（如 PlanetScale、Neon）

### 端口被占用

修改 `.env` 中的 `PORT` 为其他端口。

## 技术栈

- 后端：Node.js + Express
- 数据库：SQLite (better-sqlite3)
- 邮件：nodemailer
- 前端：原生 HTML/CSS/JavaScript

## License

MIT
