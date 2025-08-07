const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallbacksecret";

exports.generateToken = (username) => {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: "12h" });
};
