const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const { saveCredentials } = require("../utils/credentials");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_REDIRECT_URI,
} = process.env;

// Step 1: Redirect to Shopify OAuth consent screen
router.get("/connect", authMiddleware, (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).send("Missing shop parameter");
  }

  const state = Math.random().toString(36).substring(2); // CSRF protection token, store it in session if possible
  const scope = "read_orders,write_orders"; // Adjust scopes as needed

  const redirectUrl = `https://${shop}/admin/oauth/authorize?` +
    querystring.stringify({
      client_id: SHOPIFY_API_KEY,
      scope,
      redirect_uri: SHOPIFY_REDIRECT_URI,
      state,
    });

  res.redirect(redirectUrl);
});

// Step 2: Handle OAuth callback from Shopify
router.get("/callback", authMiddleware, async (req, res) => {
  const { shop, code, state } = req.query;
  if (!shop || !code) {
    return res.status(400).send("Required parameters missing");
  }

  // TODO: Verify state token here if using CSRF protection

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Save shop and access token in credentials for this client
    const clientId = req.user.clientId || req.user.id;

    await saveCredentials(clientId, {
      shopifyAccessToken: accessToken,
      shopifyShopName: shop,
    });

    res.send("Shop connected successfully! You can close this window.");
  } catch (error) {
    console.error("Shopify OAuth error:", error.response?.data || error.message);
    res.status(500).send("Failed to complete Shopify OAuth");
  }
});

module.exports = router;
