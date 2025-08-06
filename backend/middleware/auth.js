const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const db = require("../db");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user2FASecret = await db.getUser2FASecret(decoded.id);

    const twoFactorToken = req.headers["x-2fa-token"];
    if (!twoFactorToken) {
      return res.status(401).json({ error: "2FA token required" });
    }

    const verified = speakeasy.totp.verify({
      secret: user2FASecret,
      encoding: "base32",
      token: twoFactorToken,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ error: "Invalid 2FA token" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
