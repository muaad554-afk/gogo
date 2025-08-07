const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "1d";

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

    const existingUser = await User.getByUsername(username);
    if (existingUser) return res.status(409).json({ error: "Username already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await User.create({ username, passwordHash });

    res.status(201).json({ message: "User registered", userId });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.getByUsername(username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const payload = {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
    res.json({ token, twoFAEnabled: !!user.twofa_secret });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.enable2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { secret } = req.body;

    if (!secret) return res.status(400).json({ error: "Missing 2FA secret" });
    await User.set2FASecret(userId, secret);
    res.json({ message: "2FA enabled" });
  } catch (err) {
    console.error("Enable 2FA error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
