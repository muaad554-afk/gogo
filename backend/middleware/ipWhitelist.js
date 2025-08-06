const allowedIPs = (process.env.IP_WHITELIST || "").split(",").map(ip => ip.trim());

module.exports = function (req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
    return next();
  }
  res.status(403).json({ error: "Forbidden: IP not whitelisted" });
};
