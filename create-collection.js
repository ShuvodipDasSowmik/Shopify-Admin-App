require("dotenv").config();
const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");
const multer = require("multer");
const fs = require("fs");
const FormData = require("form-data");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Function to upload image to staged target
const uploadImage = async (stagedTarget, imagePath) => {
    const form = new FormData();
    stagedTarget.parameters.forEach((param) => {
        form.append(param.name, param.value);
    });
    form.append("file", fs.createReadStream(imagePath));

    const headers = {
        ...form.getHeaders(),
        "X-Shopify-Access-Token": process.env.ADMIN_API,
    };

    try {
        const uploadResponse = await axios.post(stagedTarget.resourceUrl, form, { headers });
        const parsedResponse = await xml2js.parseStringPromise(uploadResponse.data);
        return parsedResponse.PostResponse.Location[0]; // Uploaded image URL
    } catch (error) {
        console.error("Image upload failed:", error.response?.data || error.message);
        throw new Error("Failed to upload image");
    }
};

// Function to get staged upload target from Shopify
const stagedUploadsCreate = async () => {
    const mutation = `
        mutation {
            stagedUploadsCreate(input: {
                resource: PRODUCT_IMAGE,
                filename: "image.jpg",
                mimeType: "image/jpeg",
                httpMethod: POST
            }) {
                stagedTargets {
                    url
                    resourceUrl
                    parameters {
                        name
                        value
                    }
                }
            }
        }
    `;

    try {
        const response = await axios.post(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/graphql.json`,
            { query: mutation },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        );

        const stagedTargets = response.data.data?.stagedUploadsCreate?.stagedTargets;
        if (!stagedTargets || stagedTargets.length === 0) {
            throw new Error("No staged targets returned by Shopify API");
        }
        return stagedTargets[0];
    } catch (error) {
        console.error("Error fetching staged upload target:", error.response?.data || error.message);
        throw new Error("Failed to create staged upload target");
    }
};

// POST route to create collection
router.post("/create-collection", upload.single("image"), async (req, res) => {
    const { title, descriptionHtml, handle, products } = req.body;
    const imagePath = req.file?.path;

    if (!title || !descriptionHtml || !handle || !products) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        // Parse products if they are sent as a JSON string
        const productIds = typeof products === "string" ? JSON.parse(products) : products;

        let uploadedImageUrl = null;
        if (imagePath) {
            // Get staged upload target and upload image
            const stagedTarget = await stagedUploadsCreate();
            uploadedImageUrl = await uploadImage(stagedTarget, imagePath);
        }

        // Create Shopify collection
        const mutation = `
            mutation collectionCreate($input: CollectionInput!) {
                collectionCreate(input: $input) {
                    collection {
                        id
                        title
                        handle
                        image {
                            src
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const variables = {
            input: {
                title,
                descriptionHtml,
                handle,
                products: productIds,
                ...(uploadedImageUrl && { image: { src: uploadedImageUrl } }),
            },
        };

        const response = await axios.post(
            `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2025-01/graphql.json`,
            { query: mutation, variables },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.ADMIN_API,
                },
            }
        );

        const data = response.data;
        const userErrors = data.data.collectionCreate.userErrors;

        console.log(data);
        
        if (userErrors && userErrors.length > 0) {
            console.error("Shopify user errors:", userErrors);
            return res.status(400).json({ message: "Shopify API returned errors", errors: userErrors });
        }

        // Send success response
        const collection = data.data.collectionCreate.collection;
        res.json({ message: "Collection created successfully", collection });
    } catch (error) {
        console.error("Error creating collection:", error.response?.data || error.message);
        res.status(500).json({ message: "Failed to create collection", error: error.message });
    } finally {
        // Cleanup uploaded file
        if (imagePath && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }
});

module.exports = router;
