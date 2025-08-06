const allowedIPs = (process.env.TRUSTED_IPS || "")
  .split(",")
  .map(ip => ip.trim())
  .filter(ip => ip);

module.exports = (req, res, next) => {
  // Use X-Forwarded-For header for real client IP behind proxies (like Render)
  let clientIP = req.headers['x-forwarded-for']?.split(",")[0].trim() || req.ip || req.connection.remoteAddress || "";

  // Normalize IPv6 localhost
  if (clientIP === "::1") clientIP = "127.0.0.1";

  if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
    return next();
  }

  return res.status(403).json({ error: "Forbidden: IP not whitelisted" });
};
