const { db } = require('../config/db');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/token');
const { logAction } = require('../utils/logs');

const MOCK_MODE = process.env.MOCK_MODE === 'true';

// POST /login
exports.login = (req, res) => {
  const { username, password, twofaToken } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Internal error.' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches && !MOCK_MODE) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // 2FA check (stub – assume it's valid for now)
    // Add real TOTP check later in `authWith2FA` middleware
    if (user.twofa_enabled && !twofaToken && !MOCK_MODE) {
      return res.status(401).json({ error: '2FA token required.' });
    }

    const token = generateToken(user.username);

    await logAction(user.client_id, `User ${user.username} logged in.`);

    res.json({ token, message: 'Login successful.' });
  });
};

// POST /register (optional)
exports.register = async (req, res) => {
  const { username, password, clientId } = req.body;

  if (!username || !password || !clientId) {
    return res.status(400).json({ error: 'Username, password, and clientId are required.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (username, password, client_id, twofa_enabled) VALUES (?, ?, ?, 0)`,
    [username, hashedPassword, clientId],
    async function (err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ error: 'Username already exists.' });
        }
        return res.status(500).json({ error: 'Error creating user.' });
      }

      await logAction(clientId, `New user ${username} registered.`);

      res.status(201).json({ message: 'User registered successfully.' });
    }
  );
};
