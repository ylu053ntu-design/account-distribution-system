require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 初始化数据库表
async function initDatabase() {
  const client = await pool.connect();
  try {
    // 账户表（包含代金券）
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        vod_ticket TEXT,
        rtc_ticket TEXT,
        is_assigned INTEGER DEFAULT 0,
        assigned_to TEXT,
        assigned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 领取记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        account_id INTEGER REFERENCES accounts(id),
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 验证码表
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 检查并添加缺失的列（数据库迁移）
    const columnsToAdd = [
      { table: 'accounts', column: 'vod_ticket', type: 'TEXT' },
      { table: 'accounts', column: 'rtc_ticket', type: 'TEXT' }
    ];

    for (const col of columnsToAdd) {
      const checkResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [col.table, col.column]);
      
      if (checkResult.rows.length === 0) {
        await client.query(`ALTER TABLE ${col.table} ADD COLUMN ${col.column} ${col.type}`);
        console.log(`添加列: ${col.table}.${col.column}`);
      }
    }

    console.log('数据库表初始化完成');
  } finally {
    client.release();
  }
}

// 工具函数：生成验证码
function generateCode(length = 6) {
  return Math.random().toString().substring(2, 2 + length);
}

// 工具函数：发送邮件
async function sendVerificationEmail(email, code) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Your Verification Code - Baidu AI Cloud Test Account / 您的验证码 - 百度智能云测试账户',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1565c0;">Verification Code / 验证码通知</h2>
        <p>Hello! / 您好！</p>
        <p>Your verification code for Baidu AI Cloud Test Account is:</p>
        <p>您正在申请百度智能云测试账户，验证码为：</p>
        <div style="background: #e3f2fd; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #1565c0;">
          ${code}
        </div>
        <p style="color: #666;">Valid for ${process.env.VERIFICATION_CODE_EXPIRE_MINUTES || 5} minutes / 验证码有效期为 ${process.env.VERIFICATION_CODE_EXPIRE_MINUTES || 5} 分钟</p>
        <p style="color: #999; font-size: 12px;">If this was not you, please ignore this email / 如果这不是您的操作，请忽略此邮件</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// API: 检查用户是否已领取
app.post('/api/check-claim', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email required / 需要姓名和邮箱' });
    }

    // 根据姓名+邮箱查询
    const result = await pool.query(`
      SELECT c.*, a.username, a.password, a.vod_ticket, a.rtc_ticket 
      FROM claims c 
      LEFT JOIN accounts a ON c.account_id = a.id 
      WHERE c.email = $1 AND c.name = $2
    `, [email, name]);

    if (result.rows.length > 0) {
      const claim = result.rows[0];
      res.json({
        success: true,
        alreadyClaimed: true,
        data: {
          username: claim.username,
          password: claim.password,
          vod_ticket: claim.vod_ticket,
          rtc_ticket: claim.rtc_ticket,
          claimed_at: claim.claimed_at
        }
      });
    } else {
      res.json({
        success: true,
        alreadyClaimed: false
      });
    }
  } catch (error) {
    console.error('Check claim error:', error);
    res.status(500).json({ success: false, message: 'Check failed / 检查失败' });
  }
});

// API: 发送验证码
app.post('/api/send-code', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email / 请输入有效的邮箱地址' });
    }

    // 检查是否已经领取过（如果有姓名，检查姓名+邮箱匹配）
    if (name) {
      const existingClaim = await pool.query('SELECT * FROM claims WHERE email = $1 AND name = $2', [email, name]);
      if (existingClaim.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          alreadyClaimed: true,
          message: 'This email has already claimed an account / 该邮箱已经领取过账户' 
        });
      }
    } else {
      const existingClaim = await pool.query('SELECT * FROM claims WHERE email = $1', [email]);
      if (existingClaim.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          alreadyClaimed: true,
          message: 'This email has already claimed an account / 该邮箱已经领取过账户' 
        });
      }
    }

    // 生成验证码
    const code = generateCode(parseInt(process.env.VERIFICATION_CODE_LENGTH || '6'));
    const expiresAt = new Date(Date.now() + (parseInt(process.env.VERIFICATION_CODE_EXPIRE_MINUTES || '5') * 60 * 1000));

    // 保存验证码
    await pool.query('INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)', [email, code, expiresAt]);

    // 发送邮件
    await sendVerificationEmail(email, code);

    res.json({ success: true, message: 'Verification code sent to your email / 验证码已发送到您的邮箱' });
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ success: false, message: 'Failed to send code / 发送验证码失败' });
  }
});

// API: 验证验证码并领取账户
app.post('/api/claim', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, company, whatsapp, email, code } = req.body;

    if (!name || !company || !whatsapp || !email || !code) {
      return res.status(400).json({ success: false, message: 'Please fill all fields / 请填写所有必填项' });
    }

    // 检查是否已经领取过
    const existingClaim = await client.query('SELECT c.*, a.username, a.password, a.vod_ticket, a.rtc_ticket FROM claims c LEFT JOIN accounts a ON c.account_id = a.id WHERE c.email = $1 AND c.name = $2', [email, name]);
    if (existingClaim.rows.length > 0) {
      // 已经领取过，返回已领取的信息
      const claim = existingClaim.rows[0];
      return res.json({
        success: true,
        alreadyClaimed: true,
        data: {
          username: claim.username,
          password: claim.password,
          vod_ticket: claim.vod_ticket,
          rtc_ticket: claim.rtc_ticket
        }
      });
    }

    // 验证验证码
    const verificationResult = await client.query(`
      SELECT * FROM verification_codes 
      WHERE email = $1 AND code = $2 AND used = 0 AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `, [email, code]);

    if (verificationResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code / 验证码无效或已过期' });
    }

    const verificationId = verificationResult.rows[0].id;

    // 标记验证码已使用
    await client.query('UPDATE verification_codes SET used = 1 WHERE id = $1', [verificationId]);

    // 随机分配一个未使用的账户
    const accountResult = await client.query('SELECT * FROM accounts WHERE is_assigned = 0 ORDER BY RANDOM() LIMIT 1');
    
    if (accountResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No accounts available / 账户已分配完毕' });
    }

    const account = accountResult.rows[0];

    // 标记账户已分配
    await client.query('UPDATE accounts SET is_assigned = 1, assigned_to = $1, assigned_at = NOW() WHERE id = $2', [email, account.id]);

    // 记录领取信息
    await client.query('INSERT INTO claims (name, company, whatsapp, email, account_id) VALUES ($1, $2, $3, $4, $5)', [name, company, whatsapp, email, account.id]);

    res.json({
      success: true,
      alreadyClaimed: false,
      data: {
        username: account.username,
        password: account.password,
        vod_ticket: account.vod_ticket,
        rtc_ticket: account.rtc_ticket
      }
    });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ success: false, message: 'Claim failed / 领取失败' });
  } finally {
    client.release();
  }
});

// API: 管理后台 - 查看统计
app.get('/api/admin/stats', async (req, res) => {
  const password = req.headers['x-admin-password'];
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Unauthorized / 无权访问' });
  }

  try {
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM accounts');
    const assignedResult = await pool.query('SELECT COUNT(*) as count FROM accounts WHERE is_assigned = 1');
    const claimsResult = await pool.query('SELECT COUNT(*) as count FROM claims');

    res.json({
      success: true,
      data: {
        totalAccounts: parseInt(totalResult.rows[0].count),
        assignedAccounts: parseInt(assignedResult.rows[0].count),
        remainingAccounts: parseInt(totalResult.rows[0].count) - parseInt(assignedResult.rows[0].count),
        totalClaims: parseInt(claimsResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats / 加载统计失败' });
  }
});

// API: 管理后台 - 查看领取记录
app.get('/api/admin/claims', async (req, res) => {
  const password = req.headers['x-admin-password'];
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Unauthorized / 无权访问' });
  }

  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.company, c.whatsapp, c.email, c.claimed_at, 
             a.username, a.password, a.vod_ticket, a.rtc_ticket 
      FROM claims c 
      LEFT JOIN accounts a ON c.account_id = a.id 
      ORDER BY c.claimed_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to load claims / 加载记录失败' });
  }
});

// API: 添加账户（管理员用）
app.post('/api/admin/accounts', async (req, res) => {
  const password = req.headers['x-admin-password'];
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Unauthorized / 无权访问' });
  }

  try {
    const { accounts } = req.body;
    
    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({ success: false, message: 'Invalid accounts data' });
    }

    let added = 0;
    for (const account of accounts) {
      try {
        await pool.query(
          'INSERT INTO accounts (username, password, vod_ticket, rtc_ticket) VALUES ($1, $2, $3, $4)',
          [account.username, account.password, account.vod_ticket || null, account.rtc_ticket || null]
        );
        added++;
      } catch (e) {
        // 忽略重复
      }
    }

    res.json({ success: true, message: `Added ${added} accounts`, added });
  } catch (error) {
    console.error('Add accounts error:', error);
    res.status(500).json({ success: false, message: 'Failed to add accounts' });
  }
});

// API: 清空领取记录并重置账户状态（管理员用）
app.delete('/api/admin/clear-claims', async (req, res) => {
  const password = req.headers['x-admin-password'];
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Unauthorized / 无权访问' });
  }

  try {
    // 删除所有领取记录
    await pool.query('DELETE FROM claims');
    
    // 删除所有账户
    await pool.query('DELETE FROM accounts');
    
    // 删除所有验证码
    await pool.query('DELETE FROM verification_codes');

    res.json({ success: true, message: 'All data cleared / 所有数据已清空' });
  } catch (error) {
    console.error('Clear claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear claims / 清空失败' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  });
});
