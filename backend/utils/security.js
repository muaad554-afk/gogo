const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef"; // 32 bytes
const IV_LENGTH = 16;

/**
 * Mask sensitive credential strings, showing only first and last 4 characters.
 */
function maskCredential(credential) {
  if (!credential || credential.length < 8) return "****";
  const start = credential.slice(0, 4);
  const end = credential.slice(-4);
  return `${start}****${end}`;
}

/**
 * Encrypt text using AES-256-CBC
 */
function encrypt(text, ivHex) {
  const iv = Buffer.from(ivHex, "hex");
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

/**
 * Decrypt text using AES-256-CBC
 */
function decrypt(encrypted, ivHex) {
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = {
  maskCredential,
  encrypt,
  decrypt,
};
