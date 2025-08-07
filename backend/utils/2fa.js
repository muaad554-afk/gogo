// Simple 2FA stub - replace with real implementation later

function verify2FAStub(code) {
  const validCode = process.env.DEFAULT_2FA_CODE || "123456";
  return code === validCode;
}

module.exports = { verify2FAStub };
