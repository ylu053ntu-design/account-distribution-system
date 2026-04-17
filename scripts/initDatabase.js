const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/accounts.db');

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // 确保目录存在
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // 创建新数据库
  const db = new SQL.Database();

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
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
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      account_id INTEGER,
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_accounts_assigned ON accounts(is_assigned)');
  db.run('CREATE INDEX IF NOT EXISTS idx_claims_email ON claims(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes(email)');

  // 保存数据库
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('数据库初始化完成！');
  console.log('数据库路径:', dbPath);

  db.close();
}

initDatabase().catch(console.error);
