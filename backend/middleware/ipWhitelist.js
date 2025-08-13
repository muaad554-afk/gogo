const db = require("../config/db");
const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  try {
    // Skip IP check for public routes
    if (req.path.startsWith("/auth") || req.path.startsWith("/health")) {
      return next();
    }

    // Get client ID from JWT token if available
    let clientId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        clientId = decoded.id;
      } catch (err) {
        // Token invalid, continue without client ID
      }
    }

    // Get client's IP whitelist if available
    let ipWhitelist = [];
    if (clientId) {
      const client = await db.getClientById(clientId);
      if (client && client.ipWhitelist) {
        ipWhitelist = client.ipWhitelist.split(",");
      }
    }

    // If no whitelist configured, allow all
    if (ipWhitelist.length === 0) {
      return next();
    }

    const requestIp = req.ip || req.connection.remoteAddress;
    const normalizedIp = requestIp.replace(/^::ffff:/, "");

    if (ipWhitelist.includes(normalizedIp)) {
      return next();
    }

    return res.status(403).json({ error: "IP not allowed" });
  } catch (error) {
    console.error("IP whitelist error:", error);
    return next(); // Allow request if there's an error checking whitelist
  }
};
