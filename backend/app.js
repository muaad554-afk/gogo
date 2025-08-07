require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const ipWhitelist = require("./utils/ipWhitelist");
const twoFAMiddleware = require("./utils/2fa");
const logger = require("./utils/logs");

// Routes
const authRoutes = require("./routes/auth");
const setupCredentialsRoutes = require("./routes/setupCredentials");
const shopifyOAuthRoutes = require("./routes/oauth");
const adminRoutes = require("./routes/admin");
const twoFaRoutes = require("./routes/twofa");
const credentialsRoutes = require("./routes/credentials");
const fraudRoutes = require("./routes/fraud");
const ipRoutes = require("./routes/ip");

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("combined", { stream: logger.stream }));

// IP Whitelist Middleware
app.use(ipWhitelist);

// JWT Auth Middleware (skipping some routes like /auth/login)
app.use((req, res, next) => {
  if (
    req.path.startsWith("/auth") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/public")
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "JWT token missing" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired JWT token" });
  }
});

// 2FA Middleware (stub or real)
app.use(twoFAMiddleware);

// Routes
app.use("/auth", authRoutes);
app.use("/setup-credentials", setupCredentialsRoutes);
app.use("/shopify", shopifyOAuthRoutes);
app.use("/admin", adminRoutes);
app.use("/twofa", twoFaRoutes);
app.use("/credentials", credentialsRoutes);
app.use("/fraud", fraudRoutes);
app.use("/ip", ipRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.message, req.user?.clientId);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`AI Refund Automator backend listening on port ${PORT}`);
});
