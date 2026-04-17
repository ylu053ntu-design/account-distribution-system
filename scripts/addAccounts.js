const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/accounts.db');

async function addAccounts() {
  const SQL = await initSqlJs();
  
  // 加载或创建数据库
  let db;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    // 创建表
    db.run(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_assigned INTEGER DEFAULT 0,
        assigned_to TEXT,
        assigned_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        account_id INTEGER,
        claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE verification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // 示例账户数据（请替换为你的真实账户）
  const accounts = [];

  // 生成80个示例账户
  for (let i = 1; i <= 80; i++) {
    accounts.push({
      username: `test_user_${String(i).padStart(3, '0')}`,
      password: `Pass_${Math.random().toString(36).substring(2, 10)}_${i}`
    });
  }

  // 如果有CSV文件，读取它
  const csvPath = path.join(__dirname, '../accounts.csv');
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    accounts.length = 0; // 清空示例数据
    
    lines.forEach((line, index) => {
      if (index === 0) return; // 跳过标题行
      const [username, password] = line.split(',').map(s => s.trim());
      if (username && password) {
        accounts.push({ username, password });
      }
    });
  }

  // 插入账户
  for (const account of accounts) {
    try {
      db.run('INSERT OR IGNORE INTO accounts (username, password) VALUES (?, ?)', [account.username, account.password]);
    } catch (e) {
      // 忽略重复
    }
  }

  // 保存数据库
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log(`成功添加 ${accounts.length} 个账户！`);

  // 查询统计
  const result = db.exec('SELECT COUNT(*) as total FROM accounts');
  const total = result[0].values[0][0];
  
  const assignedResult = db.exec('SELECT COUNT(*) as count FROM accounts WHERE is_assigned = 1');
  const assigned = assignedResult[0].values[0][0];
  
  console.log(`账户统计: 总计 ${total} 个, 已分配 ${assigned} 个`);

  db.close();
}

addAccounts().catch(console.error);
