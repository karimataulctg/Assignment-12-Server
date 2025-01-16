const express = require('express');
const cors = require('cors');
const { ObjectId } = require('mongodb');

const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies
require('dotenv').config();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ixtwu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const database = client.db('productHuntDB');
    const collectionProducts = database.collection('products');
    const userCollection = client.db('productHuntDB').collection('users');

    // Add Product Endpoint
    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await collectionProducts.insertOne(newProduct);
      res.send(result);
    });

    // Get Products Endpoint
    app.get('/products', async (req, res) => {
      const products = await collectionProducts.find().toArray();
      res.send(products);
    });

    // Delete Product Endpoint
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await collectionProducts.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

     //User Management 01
     app.post('/users', async (req, res) => {
      const newUser = req.body;
      console.log('creating new user', newUser);
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });



  } finally {
    // Do not close the client to keep the server running
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello, Product Hunt Server is running...');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
