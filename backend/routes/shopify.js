const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const { saveCredentials, getCredentials } = require("../utils/credentials");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.get("/connect", authMiddleware, async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");

  const creds = await getCredentials(req.user.id);
  const state = Math.random().toString(36).substring(2);
  const scope = "read_orders,write_orders";

  const redirectUrl = `https://${shop}/admin/oauth/authorize?` +
    querystring.stringify({
      client_id: creds.shopifyApiKey,
      scope,
      redirect_uri: process.env.SHOPIFY_REDIRECT_URI,
      state,
    });

  res.redirect(redirectUrl);
});

router.get("/callback", authMiddleware, async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send("Missing parameters");

  try {
    const creds = await getCredentials(req.user.id);

    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: creds.shopifyApiKey,
        client_secret: creds.shopifyApiSecret,
        code,
      }
    );

    const accessToken = tokenResponse.data.access_token;

    await saveCredentials(req.user.id, {
      shopifyAccessToken: accessToken,
      shopifyShopName: shop,
    });

    res.send("Shop connected successfully. You can close this window.");
  } catch (err) {
    console.error("Shopify OAuth error:", err.response?.data || err.message);
    res.status(500).send("Failed to connect Shopify");
  }
});

module.exports = router;
