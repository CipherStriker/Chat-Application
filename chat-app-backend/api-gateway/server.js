const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const pool = require('./src/config/db');
const initializeDatabase = require('./src/config/db_init');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/userRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Gateway is running' });
});

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({ status: 'ok', db_time: result.rows[0].now });
  } catch (err) {
    console.error('Database connection error:', err.message);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.listen(PORT, async () => {
  console.log(`API Gateway listening on port ${PORT}`);
  try {
    await initializeDatabase();
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
  }
});
