const express = require("express");
const router = express.Router();
const { getWhitelistedIPs, addIPToWhitelist, removeIPFromWhitelist } = require("../utils/ipWhitelist");

// List whitelisted IPs
router.get("/whitelist", async (req, res) => {
  const ips = await getWhitelistedIPs();
  res.json({ ips });
});

// Add a new IP
router.post("/whitelist", async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: "Missing IP" });

  await addIPToWhitelist(ip);
  res.json({ success: true });
});

// Remove an IP
router.delete("/whitelist/:ip", async (req, res) => {
  const ip = req.params.ip;
  await removeIPFromWhitelist(ip);
  res.json({ success: true });
});

module.exports = router;

