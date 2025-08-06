const allowedIPs = (process.env.IP_WHITELIST || "")
  .split(",")
  .map(ip => ip.trim());

module.exports = function (req, res, next) {
  // Prefer x-forwarded-for header for real client IP behind proxies
  let clientIP = req.headers['x-forwarded-for']?.split(",")[0].trim() || req.ip;

  // Normalize IPv6 localhost
  if (clientIP === "::1") clientIP = "127.0.0.1";

  if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
    return next();
}

  res.status(403).json({ error: "Forbidden: IP not whitelisted" });
};
const allowedIPs = (process.env.TRUSTED_IPS || "").split(",").map(ip => ip.trim()).filter(ip => ip);

module.exports = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || "";

  if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
    return next();
  }

  return res.status(403).json({ error: "Forbidden: IP not whitelisted" });
};
