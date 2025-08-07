const request = require("supertest");
const app = require("../app");

describe("Refund Endpoint", () => {
  it("should return order details and status", async () => {
    const res = await request(app)
      .post("/refund")
      .send({
        clientId: "testClient",
        emailText: "I'd like a refund for order #ABC123 worth $25",
        paymentPlatform: "stripe",
        transactionId: "txn_test_123"
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("orderId");
  });
});
