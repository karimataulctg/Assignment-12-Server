const express = require('express');
const cors = require('cors');
const { ObjectId } = require('mongodb');

const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // Allow requests from this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow these methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow these headers
}));
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
    const reviewsCollection = database.collection('reviews'); // Add reviews collection

    // Add Product Endpoint
    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await collectionProducts.insertOne(newProduct);
      res.send(result);
    });

    // Get All Products Endpoint
    app.get('/products', async (req, res) => {
      const products = await collectionProducts.find().toArray();
      res.send(products);
    });

    // Get Product by ID Endpoint
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format' });
      }
      const product = await collectionProducts.findOne({ _id: new ObjectId(id) });
      if (product) {
        res.send(product);
      } else {
        res.status(404).send({ message: 'Product not found' });
      }
    });

    // Get Featured Products Endpoint
    app.get('/products/featured', async (req, res) => {
      const products = await collectionProducts.find({ featured: true }).toArray();
      res.send(products);
    });

    // Update Product Endpoint
    app.put('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format' });
      }

      const updatedProductData = req.body;
      const result = await collectionProducts.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedProductData }
      );

      if (result.modifiedCount === 1) {
        res.send({ message: 'Product updated successfully' });
      } else {
        res.status(404).send({ message: 'Product not found' });
      }
    });

    // Delete Product Endpoint
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format' });
      }
      const result = await collectionProducts.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 1) {
        res.send({ message: 'Product successfully deleted' });
      } else {
        res.status(404).send({ message: 'Product not found' });
      }
    });

    // Add Review Endpoint
    app.post('/reviews', async (req, res) => {
      const newReview = req.body;
      const result = await reviewsCollection.insertOne(newReview);
      res.send(result);
    });

    // Get Reviews for a Product Endpoint
    app.get('/reviews', async (req, res) => {
      const productId = req.query.productId;
      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }
      const reviews = await reviewsCollection.find({ productId: new ObjectId(productId) }).toArray();
      res.send(reviews);
    });

    // User Management
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      console.log('Adding new User', newUser);
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { email: email };
      }
      const users = await userCollection.find(query).toArray();
      res.send(users);
    });

    app.put('/users/:id', async (req, res) => {
      const id = new ObjectId(req.params.id);
      const updatedUser = req.body;
      console.log('Updating User', updatedUser);
      const result = await userCollection.updateOne({ _id: id }, { $set: updatedUser });
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
