const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const logger = require("../utils/logs");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "24h";

// Register new user (admin flag optional)
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, isAdmin } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existingUser = await db.getClientByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = await db.createClient({
      email,
      password: passwordHash,
      name: name || email.split('@')[0],
      isAdmin: !!isAdmin
    });
    
    logger.info(`New user registered: ${email}`, userId);
    res.status(201).json({ 
      message: "User registered successfully",
      userId 
    });
  } catch (err) {
    logger.error("Registration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login user + issue JWT
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await db.getClientByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        isAdmin: user.isAdmin === 1 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    const has2FA = await db.getUser2FASecret(user.id);
    
    logger.info(`User logged in: ${email}`, user.id);
    res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin === 1
      },
      twoFactorEnabled: !!has2FA
    });
  } catch (err) {
    logger.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user profile
router.get("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await db.getClientById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin === 1,
      created_at: user.created_at
    });
  } catch (err) {
    logger.error("Profile fetch error:", err);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;