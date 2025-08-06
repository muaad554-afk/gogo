const { db } = require('../config/db');

function getUserByEmail(email, callback) {
  db.get('SELECT * FROM users WHERE email = ?', [email], callback);
}

function createUser({ email, password, isAdmin }, callback) {
  db.run(
    'INSERT INTO users (email, password, is_admin) VALUES (?, ?, ?)',
    [email, password, isAdmin ? 1 : 0],
    callback
  );
}

module.exports = { getUserByEmail, createUser };
