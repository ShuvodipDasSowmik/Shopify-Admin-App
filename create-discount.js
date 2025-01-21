require("dotenv").config();
const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/create-discount", async (req, res) => {
    res.send("Discount route")
})

router.post("/create-discount", async (req, res) => {
    const { variables } = req.body;


    const automaticBasicDiscount = { automaticBasicDiscount: variables.automaticBasicDiscount };


    const query =
        `mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
          automaticDiscountNode{
            automaticDiscount {
                ... on DiscountAutomaticBasic {
                endsAt
                startsAt
                title
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;

    try {

        console.log(automaticBasicDiscount);

        const headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": process.env.ADMIN_API,
        };

        // Make the request to Shopify API
        const response = await axios.post(`https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/graphql.json`, {
            query: query,
            variables: automaticBasicDiscount
        }, { headers });

        console.log(response.data);

        const { data } = response;

        if (data.errors) {
            return res.status(400).json({ message: data.errors[0].message });
        }

        // const discount = data.data.discountAutomaticBasicCreate.automaticDiscountNode;
        return res.status(200).json({
            message: `success`
        });

    } catch (error) {
        console.error("Error creating discount:", error);
        return res.status(500).json({ message: "An error occurred while creating the discount." });
    }
});



const query = `query {
    discountNodes(first: 10) {
      edges {
        node {
          id
          discount {
            ... on DiscountAutomaticBasic {
              title
              summary
              status
            }
          }
        }
      }
    }
  }`;


router.get("/get-discounts", async (req, res) => {
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

        res.status(200).json(response.data.data);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send({ error: "Failed to fetch orders", details: error.message });
    }
});


module.exports = router;