require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimiter = require('./middleware/rateLimiter');
const db = require('./config/db');
const ipWhitelist = require('./middleware/ipWhitelist');
const logger = require('./middleware/logger');

// Routes
const authRoutes = require('./routes/auth');
const refundRoutes = require('./routes/refund');
const credentialsRoutes = require('./routes/setupCredentials');
const twofaRoutes = require('./routes/twofa');
const adminRoutes = require('./routes/admin');

const app = express();

// Init DB
db.init();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));
app.use(rateLimiter);
app.use(ipWhitelist);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/refund', refundRoutes);
app.use('/api/2fa', twofaRoutes);
app.use('/api/setup-credentials', credentialsRoutes);
app.use('/api/admin', adminRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
