const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const generateSecret = () => crypto.randomBytes(32).toString('hex');
const generateShortKey = () => crypto.randomBytes(10).toString('hex');

const envContent = `# =============================================
# Auto-generated environment configuration
# Generated on: ${new Date().toISOString().split('T')[0]}
# =============================================

# --- Database ---
POSTGRES_USER=chatadmin
POSTGRES_PASSWORD=${generateSecret()}
POSTGRES_DB=chatdb

# --- MinIO Object Storage ---
MINIO_ACCESS_KEY=${generateShortKey()}
MINIO_SECRET_KEY=${generateSecret()}

# --- Authentication ---
JWT_SECRET=${generateSecret()}
`;

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('A .env file already exists. Overwrite? (y/N): ', (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() === 'y') {
      writeEnv(envPath, envContent);
    } else {
      console.log('Setup cancelled. Existing .env file was not modified.');
    }
  });
} else {
  writeEnv(envPath, envContent);
}

function writeEnv(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('');
  console.log('============================================');
  console.log('  Setup complete -- secrets generated');
  console.log('============================================');
  console.log('');
  console.log('  File written: .env');
  console.log('');
  console.log('  Next step:');
  console.log('    docker compose up --build -d');
  console.log('');
}
