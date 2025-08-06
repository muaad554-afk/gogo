const ip = require("ip");

module.exports = function (req, res, next) {
  const whitelist = process.env.IP_WHITELIST?.split(",") || [];
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;

  if (!whitelist.includes(clientIp) && !whitelist.includes("::1")) {
    return res.status(403).json({ message: "IP not allowed" });
  }

  next();
};
