const ipWhitelist = process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(",") : [];

module.exports = (req, res, next) => {
  if (ipWhitelist.length === 0) return next(); // no whitelist means allow all

  const requestIp = req.ip || req.connection.remoteAddress;

  // Normalize IPv4-mapped IPv6 format if present (e.g. "::ffff:127.0.0.1")
  const normalizedIp = requestIp.replace(/^::ffff:/, "");

  if (ipWhitelist.includes(normalizedIp)) {
    return next();
  }

  return res.status(403).json({ error: "IP not allowed" });
};
