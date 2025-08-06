const express = require("express");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const refundRoutes = require("./routes/refund");
const ipWhitelistMiddleware = require("./middleware/ipWhitelist");
const authMiddleware = require("./middleware/auth");

dotenv.config();

const app = express();

app.use(express.json());
app.use(ipWhitelistMiddleware);

// Public auth routes (signup, login, 2FA setup)
app.use("/auth", authRoutes);

// Protected refund routes
app.use("/refund", authMiddleware, refundRoutes);

app.get("/", (req, res) => {
  res.send("Refund Automation Backend is live");
});

// Global error handlers
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
