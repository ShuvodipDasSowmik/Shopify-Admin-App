require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js')

const app = express();

app.use(cors());
app.use(express.json());

const Restock = require('./restock')
app.use("/", Restock)

const Orders = require('./orders')
app.use("/", Orders)

const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');

const upload = multer({ dest: 'uploads/' });

const shop = 'theme321';

const shopName = { shop: "theme321" };
const query = `
  query {
    products(first: 250) {
      edges {
        node {
          id
          handle
          totalInventory
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

app.get('/', async (req, res) => {
  res.send('Hello World');
});

// app.get('/get-products', async (req, res) => {
//   res.send('Hello World');
// });

app.get('/get-products', async (req, res) => {
  try {
    axios.post(`https://${shop}.myshopify.com/admin/api/2025-01/graphql.json`, {
      query: query
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.ADMIN_API
      }
    })
      .then(response => {
        console.log(response.data);
        res.send({ ...response.data, ...shopName });
      })
      .catch(error => {
        console.error(error);
      });
  } catch (error) {
    console.error(error);
  }
});

app.get('/create-product', async (req, res) => {
  res.send('Hello World');
});



const uploadImage = async (stagedTarget, imagePath) => {
  const form = new FormData();

  stagedTarget.parameters.forEach(param => {
    form.append(param.name, param.value);
  });

  form.append('file', fs.createReadStream(imagePath));

  const headers = {
    ...form.getHeaders(),
    'X-Shopify-Access-Token': process.env.ADMIN_API
  };

  try {
    const uploadResponse = await axios.post(stagedTarget.resourceUrl, form, {
      headers: headers
    });

    console.log('Raw upload response:', uploadResponse.data);

    const parsedResponse = await xml2js.parseStringPromise(uploadResponse.data);
    const imageUrl = parsedResponse.PostResponse.Location[0]; 

    console.log('Image uploaded successfully. URL:', imageUrl);

    return imageUrl;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
};


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
      `https://${shop}.myshopify.com/admin/api/2025-01/graphql.json`,
      { query: mutation },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.ADMIN_API,
        },
      }
    );

    console.log('API Response:', JSON.stringify(response.data, null, 2));

    if (response.data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
      throw new Error('GraphQL query failed');
    }

    const stagedTargets = response.data.data?.stagedUploadsCreate?.stagedTargets;

    if (!stagedTargets || stagedTargets.length === 0) {
      throw new Error('No staged targets returned by the API');
    }

    return stagedTargets[0];
  } catch (error) {
    // Log detailed error information
    console.error('Request Failed:', error.response?.data || error.message);
    throw error;
  }
};



app.post('/create-product', upload.single('image'), async (req, res) => {
  const { title, body_html, vendor, product_type, tags, price, stock } = req.body;
  const imagePath = req.file.path;

  try {
    const stagedTarget = await stagedUploadsCreate();
    const uploadResponse = await uploadImage(stagedTarget, imagePath);

    const product = {
      "product": {
        "title": title,
        "body_html": body_html,
        "vendor": vendor,
        "product_type": product_type,
        "tags": tags,
        "images": [
          {
            src: uploadResponse
          }
        ],
        "variants": [
          {
            "price": price,
            "inventory_quantity": stock,
            "inventory_management": "shopify"
          }
        ],
        "tracksInventory" : "true"
      }
    };
    // const result = await createProductWithImage(title, bodyHtml, vendor, productType, stagedTarget.resourceUrl);

    fs.unlinkSync(imagePath);

    axios.post(`https://${shop}.myshopify.com/admin/api/2025-01/products.json`, product, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.ADMIN_API
      }
    })
      .then(response => {
        console.log(response.data);
        res.send({message: 'success'});
      })
      .catch(error => {
        console.error(error);
      });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

module.exports = app;