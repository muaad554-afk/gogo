const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const db = require("../db");

const router = express.Router();

// Signup (creates user, hashes password)
router.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.createUser(username, hashedPassword);
    res.json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

// Login (validate password, return JWT)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const user = await db.getUserByUsername(username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "8h" });

  res.json({ token, twoFASetup: !!user.twofa_secret });
});

// Generate 2FA secret and QR code for user
router.post("/2fa/setup", async (req, res) => {
  const { token } = req.headers;
  if (!token) return res.status(401).json({ error: "JWT token required" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid JWT token" });
  }

  const secret = speakeasy.generateSecret({ name: `RefundAutomator (${decoded.username})` });
  await db.setUser2FASecret(decoded.id, secret.base32);

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ secret: secret.base32, qrCodeUrl });
});

// Verify 2FA token for first time activation
router.post("/2fa/verify", async (req, res) => {
  const { token, twoFactorToken } = req.body;
  if (!token || !twoFactorToken) return res.status(400).json({ error: "JWT and 2FA token required" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid JWT token" });
  }

  const secret = await db.getUser2FASecret(decoded.id);
  if (!secret) return res.status(400).json({ error: "2FA secret not setup" });

  const verified = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: twoFactorToken,
    window: 1
  });

  if (!verified) return res.status(400).json({ error: "Invalid 2FA token" });

  res.json({ message: "2FA verified and enabled" });
});

module.exports = router;
