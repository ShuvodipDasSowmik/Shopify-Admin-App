require("dotenv").config();
const express = require("express");
const axios = require("axios");

const router = express.Router();


router.get("/orders", async (req, res) => {
    const query = `
        query {
            orders(first: 10) {
                edges {
                    node {
                        id
                        createdAt
                        totalPrice
                        customer {
                            displayName
                            addresses(first: 1){
                                address1
                                city
                                country
                            }
                            email
                        }
                        lineItems(first: 5) {
                            edges {
                                node {
                                    title
                                    quantity
                                }
                            }
                        }
                        currentTotalPriceSet{
                            shopMoney{
                                amount
                                currencyCode
                            }
                        }
                    }
                }
            }
        }
    `;

    try {
        const response = await axios.post(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-07/graphql.json`,
            { query },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        );

        if (response.data.errors) {
            return res.status(500).send({ error: "Error fetching orders", details: response.data.errors });
        }

        res.status(200).json(response.data.data.orders.edges);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send({ error: "Failed to fetch orders", details: error.message });
    }
});


router.post("/orders", (req, res) => {
    res.send("Hemlo");
});

module.exports = router;
