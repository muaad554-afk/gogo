const express = require("express");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");

const router = express.Router();

// Generate and return 2FA secret + QR code URL
router.get("/setup", authMiddleware, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `AI Refund Automator (${req.user.username})`,
    });

    // Save secret temporarily; client must verify token to confirm
    await db.setUser2FASecret(req.user.id, secret.base32);

    // Generate QR code data URL for authenticator apps
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({ secret: secret.base32, qrCodeUrl });
  } catch (err) {
    console.error("2FA setup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify 2FA token and activate
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "2FA token required" });

    const secret = await db.getUser2FASecret(req.user.id);
    if (!secret) return res.status(400).json({ error: "2FA not setup" });

    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) {
      return res.status(401).json({ error: "Invalid 2FA token" });
    }

    res.json({ message: "2FA verified successfully" });
  } catch (err) {
    console.error("2FA verify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
