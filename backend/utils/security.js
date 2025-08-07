// backend/utils/security.js

/**
 * Mask sensitive credential strings, showing only first and last 4 characters.
 * Example: "sk_test_1234567890abcdef" => "sk_t****cdef"
 * @param {string} credential 
 * @returns {string}
 */
function maskCredential(credential) {
  if (!credential || credential.length < 8) return "****";
  const start = credential.slice(0, 4);
  const end = credential.slice(-4);
  return `${start}****${end}`;
}

module.exports = { maskCredential };
