function mockMode(req, res, next) {
  req.isMock = process.env.MOCK_MODE === "true";
  next();
}

module.exports = mockMode;
