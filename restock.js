require("dotenv").config();
const express = require("express");
const axios = require("axios");


const router = express.Router();

router.get("/restock", (req, res) => {
    res.send("Restock Route");
});

router.post("/restock", async (req, res) => {
    const { productGlobalId, restockQuantity } = req.body;
    console.log(req.body);

    if (!productGlobalId || !restockQuantity) {
        return res.status(400).send({
            error: "Missing productGlobalId or restockQuantity in the request.",
        });
    }

    try {
        const productQuery = `
      query {
        product(id: "${productGlobalId}") {
          variants(first: 1) {
            edges {
              node {
                inventoryItem {
                  id
                }
              }
            }
          }
        }
      }
    `;


        const productResponse = await axios.post(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/graphql.json`,
            { query: productQuery },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        );

        const inventoryItemId =
            productResponse.data.data.product.variants.edges[0].node.inventoryItem.id;

        // Step 2: Fetch Location ID
        const locationResponse = await axios.get(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/locations.json`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        );

        const locationId = locationResponse.data.locations[0].id;

        const locationGlobalId = `gid://shopify/Location/${locationId}`;

        console.log(
            "Inventory item id: " + inventoryItemId + " LocationID = " + locationId
        );

        const iQuery = `
  query {
    product(id: "${productGlobalId}") {
      variants(first: 10) {
        edges {
          node {
            id
            inventoryItem {
              id
              inventoryLevels(first: 5) {
                edges {
                  node {
                    id
                    location {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

        const iResponse = await axios.post(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/graphql.json`,
            { query: iQuery },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        );

        console.log(iResponse.data.data.product.variants.edges[0].node.inventoryItem.inventoryLevels.edges[0].node.id);

        const inventoryLevelID = iResponse.data.data.product.variants.edges[0].node.inventoryItem.inventoryLevels.edges[0].node.id


        const qQuery = `
  query {
    inventoryLevel(id: "${inventoryLevelID}"){
        quantities(names: "available"){
            quantity
        }
    }
  }
`;

        const inventoryLevelResponse = await axios.post(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/graphql.json`,
            { query: qQuery },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        );

        console.log(qQuery);


        // const currentQuantity = inventoryLevelResponse.data.inventoryLevels;
        console.log(inventoryLevelResponse.data.data.inventoryLevel.quantities[0].quantity);

        const currentQuantity = inventoryLevelResponse.data.data.inventoryLevel.quantities[0].quantity;


        const quantity = restockQuantity + currentQuantity;

        const mutation = `
    mutation {
      inventorySetQuantities(input: {
        name: "available",
        reason: "restock",
        quantities: [{
          inventoryItemId: "${inventoryItemId}",
          locationId: "${locationGlobalId}",
          quantity: ${quantity},
          compareQuantity: ${currentQuantity}
        }]
      }) {
        inventoryAdjustmentGroup {
          createdAt
          reason
          referenceDocumentUri
          changes {
            name
            delta
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

        const inventoryResponse = await axios.post(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/graphql.json`,
            { query: mutation },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        )

        if (inventoryResponse.data.errors) {
            console.log("Errors:", inventoryResponse.data.errors);
        }

        if (inventoryResponse.data.data.inventorySetQuantities) {
            const { inventoryAdjustmentGroup, userErrors } =
                inventoryResponse.data.data.inventorySetQuantities;
            console.log("Inventory Adjustment Group:", inventoryAdjustmentGroup);
            console.log("User Errors:", userErrors);

            return res.status(200).json({message: "success"});
        } else {
            console.log("No data returned from inventorySetQuantities mutation.");
        }

    } catch (error) {
        console.error(
            "Error updating stock:",
            error.response?.data || error.message
        );
        res
            .status(500)
            .send({ error: "Failed to update stock", details: error.message });
    }
});

module.exports = router;
