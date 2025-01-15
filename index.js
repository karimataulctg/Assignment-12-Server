const express = require('express');
const cors = require('cors');

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
    await client.connect(); // Ensure the client connects to MongoDB
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const database = client.db('productHuntDB');
    const collectionProducts = database.collection('products');

    // Add Product Endpoint
    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await collectionProducts.insertOne(newProduct);
      res.send(result);
    });

    app.get('/products', async (req, res) => {
      const email = req.query.email; 
     let query = {};
      if (email) { query = { email: email };
    } const result = await collectionProducts.find(query).toArray(); 
    res.send(result); 
   });

   app.get('/products/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await collectionProducts.findOne(query);
    res.send(result);
  });
    



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello, Product Hunt Server is running...');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
