const speakeasy = require("speakeasy");
const db = require("../db");

module.exports = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user" });
    }

    const user2FASecret = await db.getUser2FASecret(userId);
    if (!user2FASecret) {
      return next(); // Skip if 2FA not enabled
    }

    const twoFactorToken = req.headers["x-2fa-token"];
    if (!twoFactorToken) {
      return res.status(401).json({ error: "2FA token required" });
    }

    const verified = speakeasy.totp.verify({
      secret: user2FASecret,
      encoding: "base32",
      token: twoFactorToken,
      window: 1,
    });

    if (!verified) {
      return res.status(401).json({ error: "Invalid 2FA token" });
    }

    next();
  } catch (err) {
    console.error("2FA Error:", err);
    return res.status(401).json({ error: "2FA validation failed" });
  }
};
