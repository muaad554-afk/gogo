const fs = require("fs");
const path = require("path");

const WHITELIST_FILE = path.join(__dirname, "../data/ip_whitelist.json");

function loadWhitelist() {
  if (!fs.existsSync(WHITELIST_FILE)) return [];
  return JSON.parse(fs.readFileSync(WHITELIST_FILE, "utf-8"));
}

function saveWhitelist(ips) {
  fs.writeFileSync(WHITELIST_FILE, JSON.stringify(ips, null, 2));
}

function getWhitelistedIPs() {
  return loadWhitelist();
}

function addIPToWhitelist(ip) {
  const ips = loadWhitelist();
  if (!ips.includes(ip)) {
    ips.push(ip);
    saveWhitelist(ips);
  }
}

function removeIPFromWhitelist(ip) {
  const ips = loadWhitelist().filter((item) => item !== ip);
  saveWhitelist(ips);
}

function isIPWhitelisted(ip) {
  const ips = loadWhitelist();
  return ips.includes(ip);
}

module.exports = {
  getWhitelistedIPs,
  addIPToWhitelist,
  removeIPFromWhitelist,
  isIPWhitelisted,
};
