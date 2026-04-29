const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function initializeDatabase() {
  const sqlPath = path.join(__dirname, '..', 'db', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
  console.log('Database schema initialized successfully');
}

module.exports = initializeDatabase;
