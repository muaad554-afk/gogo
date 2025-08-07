const jwt = require("jsonwebtoken");
const { generateToken } = require("../utils/token");

const users = {}; // In-memory for MVP. Use DB in prod.

exports.signup = (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(400).json({ error: "User exists" });
  users[username] = { password };
  const token = generateToken(username);
  res.json({ token });
};

exports.login = (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = generateToken(username);
  res.json({ token });
};
