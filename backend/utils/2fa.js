// utils/2fa.js — 2FA middleware stub
module.exports = (req, res, next) => {
  const code = req.headers["x-2fa-code"];

  const validCode = process.env.DEFAULT_2FA_CODE || "123456";

  if (!code) {
    return res.status(401).json({ error: "2FA code missing" });
  }

  if (code !== validCode) {
    return res.status(401).json({ error: "Invalid 2FA code" });
  }

  next();
};
