require("dotenv").config();
const express = require("express");
const axios = require("axios");

const router = express.Router();

const query = `
  {
    collections(first: 10) {
      edges {
        node {
          id
          title
          handle
          updatedAt
          productsCount{
            count
          }
        }
      }
    }
  }
`;

router.use("/get-collections", async (req, res) => {
  try {
    const response = await axios.post(
      `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-07/graphql.json`,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.ADMIN_API,
        },
      }
    );

    // Check if collections exist and return them
    const collections = response.data.data.collections.edges;
    if (collections.length > 0) {
      res.json({
        collections: collections.map((collection) => ({
          id: collection.node.id,
          title: collection.node.title,
          handle: collection.node.handle,
          updatedAt: collection.node.updatedAt,
          productCount: collection.node.productsCount.count
        })),
      });
    } else {
      res.status(404).json({ success: false, message: "No collections found." });
    }
  } catch (error) {
    console.error("Error fetching collections:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


module.exports = router