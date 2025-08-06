const speakeasy = require("speakeasy");
const db = require("../config/db");

module.exports = async function (req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user info" });
    }

    const twoFactorToken = req.headers["x-2fa-token"];
    if (!twoFactorToken) {
      return res.status(401).json({ error: "2FA token required" });
    }

    const secret = await db.getUser2FASecret(userId);
    if (!secret) {
      return res.status(403).json({ error: "2FA not enabled for user" });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: twoFactorToken,
      window: 1,
    });

    if (!verified) {
      return res.status(403).json({ error: "Invalid 2FA token" });
    }

    next();
  } catch (err) {
    console.error("2FA verification error:", err);
    res.status(500).json({ error: "Internal server error during 2FA verification" });
  }
};
