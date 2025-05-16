const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware

app.use(cors({
  origin: ['http://localhost:5174', 'https://product-hunt-a156b.web.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


app.use(express.json()); // Parse JSON body

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ixtwu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // await client.connect();
    console.log("Connected to MongoDB!");

    const database = client.db('productHuntDB');
    const collectionProducts = database.collection('products');
    const userCollection = database.collection('users');
    const reviewsCollection = database.collection('reviews');
    const reportsCollection = database.collection('reports');
    const couponsCollection = database.collection('coupons');



    // Endpoint to get statistics
   app.get('/admin/statistics', async (req, res) => {
  try {
    // Product Statistics
    const totalProducts = await collectionProducts.countDocuments({});
    const acceptedProducts = await collectionProducts.countDocuments({ status: 'Accepted' });
    const pendingProducts = await collectionProducts.countDocuments({ status: 'Pending' });

    // Review Statistics
    const totalReviews = await reviewsCollection.countDocuments({});

    // User Statistics
    const totalUsers = await userCollection.countDocuments({});
    const creatorsCount = await userCollection.countDocuments({ 
      role: { $regex: /^creator$/i } 
    });

    // Upvotes Calculation
    const upvotesResult = await collectionProducts.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $size: "$upvotedBy" } }
        }
      }
    ]).toArray();

    const statistics = {
      totalProducts,
      acceptedProducts,
      pendingProducts,
      totalReviews,
      totalUsers,
      creatorsCount,  // Separate from totalUsers for clarity
      upvotes: upvotesResult[0]?.total || 0
    };

    res.send(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
    // Endpoint to add a coupon
  app.post('/coupons', async (req, res) => {
    const { code, expiryDate, description, discountAmount } = req.body;

    if (!code || !expiryDate || !description || !discountAmount) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    try {
      const newCoupon = {
        code,
        expiryDate: new Date(expiryDate),
        description,
        discountAmount: parseFloat(discountAmount),
      };

      const result = await couponsCollection.insertOne(newCoupon);

      if (result.insertedCount === 1) {
        res.status(201).json({ message: 'Coupon added successfully', coupon: newCoupon });
      } else {
        res.status(500).json({ message: 'Failed to add coupon' });
      }
    } catch (error) {
      console.error('Error adding coupon:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get("/carts", async (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }
    const cartItems = await database.collection("carts").find({ userEmail: email }).toArray();
    if (!cartItems.length) {
        return res.status(404).json({ message: "No cart items found" });
    }
    res.json(cartItems);
});



    app.get('/coupons', async (req, res) => {
      try {
        const coupons = await couponsCollection.find({}).toArray();
        res.send(coupons);
      } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    app.put('/coupons/:id', async (req, res) => {
      const couponId = req.params.id;
      const { code, expiryDate, description, discountAmount } = req.body;

      if (!ObjectId.isValid(couponId)) {
        return res.status(400).send({ message: 'Invalid coupon ID format' });
      }

      try {
        const result = await couponsCollection.updateOne(
          { _id: new ObjectId(couponId) },
          { $set: { code, expiryDate, description, discountAmount } }
        );
        res.send({ message: 'Coupon updated successfully' });
      } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    app.delete('/coupons/:id', async (req, res) => {
      const couponId = req.params.id;

      if (!ObjectId.isValid(couponId)) {
        return res.status(400).send({ message: 'Invalid coupon ID format' });
      }

      try {
        const result = await couponsCollection.deleteOne({ _id: new ObjectId(couponId) });
        res.send({ message: 'Coupon deleted successfully' });
      } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Endpoint to get valid coupons
app.get('/coupons/valid', async (req, res) => {
  try {
    const currentDate = new Date();
    const validCoupons = await couponsCollection.find({ expiryDate: { $gte: currentDate } }).toArray();
    res.send(validCoupons);
  } catch (error) {
    console.error('Error fetching valid coupons:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to validate and apply coupon
app.post('/apply-coupon', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'Coupon code is required' });
  }

  try {
    const currentDate = new Date();
    const coupon = await couponsCollection.findOne({ code, expiryDate: { $gte: currentDate } });

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid or expired coupon' });
    }

    res.json({ message: 'Coupon applied successfully', discountAmount: coupon.discountAmount });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



    // Auth Routes
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '10h' });
      res.cookie("token", token).send({ success: true });
    });

    app.post('/logout', (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Product Routes
    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await collectionProducts.insertOne(newProduct);
      res.send(result);
    });

    app.get('/products', async (req, res) => {
      const { userId, featured, tag } = req.query;
      console.log("Received Query Parameters:", req.query); // 🛠 Debugging line

      let query = {};

      if (userId) {
        if (!ObjectId.isValid(userId)) {
          return res.status(400).send({ message: 'Invalid user ID format' });
        }
        query.owner = new ObjectId(userId);
      }

      if (featured) {
        query.featured = featured === 'true';
      }

      if (tag) {
        query.tags = tag; // 🔥 Ensure tag filtering is applied correctly
      }

      try {
        const products = await collectionProducts.find(query).toArray();
        console.log("Products Found:", products); // 🛠 Debugging line
        res.send(products);
      } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format' });
      }
      const product = await collectionProducts.findOne({ _id: new ObjectId(id) });
      product ? res.send(product) : res.status(404).send({ message: 'Product not found' });
    });

    app.put('/products/:id', async (req, res) => {
      const productId = req.params.id;
      const { name, image, description, tags, externalLinks } = req.body;

      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }

      const updateData = {
        name,
        image,
        description,
        tags,
        externalLinks,
        updatedAt: new Date()
      };

      const result = await collectionProducts.updateOne(
        { _id: new ObjectId(productId) },
        { $set: updateData }
      );

      result.modifiedCount
        ? res.send({ message: 'Product updated successfully' })
        : res.status(404).send({ message: 'Product not found' });
    });

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format' });
      }
      const result = await collectionProducts.deleteOne({ _id: new ObjectId(id) });
      result.deletedCount
        ? res.send({ message: 'Product successfully deleted' })
        : res.status(404).send({ message: 'Product not found' });
    });

    // Upvote a Product
    app.post("/products/:id/upvote", async (req, res) => {
      const { id } = req.params;
      const { email } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid Product ID" });
      }

      try {
        const product = await collectionProducts.findOne({ _id: new ObjectId(id) });

        if (!product) {
          return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.upvotedBy && product.upvotedBy.includes(email)) {
          return res.status(400).json({ success: false, message: "You have already voted" });
        }

        const result = await collectionProducts.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { votes: 1 },
            $push: { upvotedBy: email }
          }
        );

        if (result.modifiedCount === 1) {
          res.json({ success: true, message: "Product upvoted successfully", votes: product.votes + 1 });
        } else {
          res.status(500).json({ success: false, message: "Upvote failed" });
        }
      } catch (error) {
        console.error("Upvote Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });


    // Update product status to "featured"
    app.put('/products/:id/feature', async (req, res) => {
      const productId = req.params.id;

      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }

      const result = await collectionProducts.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { featured: true } }
      );

      result.modifiedCount
        ? res.send({ message: 'Product marked as featured successfully' })
        : res.status(404).send({ message: 'Product not found' });
    });

    // Update product status
    app.put('/products/:id/status', async (req, res) => {
      const productId = req.params.id;
      const { status } = req.body;

      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }

      const result = await collectionProducts.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { status } }
      );

      result.modifiedCount
        ? res.send({ message: `Product status updated to ${status}` })
        : res.status(404).send({ message: 'Product not found' });
    });


    // Fetch reported products
    app.get('/reported-products', async (req, res) => {
      try {
        const reportedProducts = await collectionProducts.find({ reported: true }).toArray();
        res.send(reportedProducts);
      } catch (error) {
        console.error('Error fetching reported products:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Delete reported product
    app.delete('/products/:id', async (req, res) => {
      const productId = req.params.id;

      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }

      const result = await collectionProducts.deleteOne({ _id: new ObjectId(productId) });

      result.deletedCount
        ? res.send({ message: 'Product deleted successfully' })
        : res.status(404).send({ message: 'Product not found' });
    });


    // Report product
    app.post('/products/:id/report', async (req, res) => {
      const productId = req.params.id;
      const { userId, reason } = req.body;

      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }

      const result = await collectionProducts.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { reported: true }, $push: { reports: { userId, reason, reportedAt: new Date() } } }
      );

      result.modifiedCount
        ? res.send({ message: 'Product reported successfully' })
        : res.status(404).send({ message: 'Product not found' });
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

    // Get Reviews for a Product Endpoint
    app.get('/products/:id/reviews', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }
      const reviews = await reviewsCollection.find({ productId: id }).toArray();
      res.send(reviews);
    });


    // Report Product Endpoint
    app.post('/products/:id/report', async (req, res) => {
      const productId = req.params.id;
      const { userId, reason } = req.body;

      if (!ObjectId.isValid(productId)) {
        return res.status(400).send({ message: 'Invalid product ID format' });
      }

      const report = {
        productId: new ObjectId(productId),
        userId: new ObjectId(userId),
        reason,
        timestamp: new Date(),
      };

      const result = await reportsCollection.insertOne(report);

      if (result.insertedCount === 1) {
        res.send({ message: 'Product reported successfully' });
      } else {
        res.status(500).send({ message: 'Error reporting product' });
      }
    });

    app.get('/users', async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch users', error });
      }
    });



  // Endpoint to check if a user is an admin
  app.get('/users/admin/:email', async (req, res) => {
    const email = req.params.email;
    try {
      const user = await userCollection.findOne({ email });
      if (user && user.role === 'admin') {
        res.json({ admin: true });
      } else {
        res.json({ admin: false });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // User Routes
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.post('/login', async (req, res) => {
      const { email, password } = req.body;
      const user = await userCollection.findOne({ email });

      if (user && (await bcrypt.compare(password, user.password))) {
        const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, {
          expiresIn: '5h'
        });
        res.cookie("token", token, { httpOnly: true }).send({ success: true, user });
      } else {
        res.status(401).send({ success: false, message: 'Invalid email or password' });
      }
    });

    // Endpoint to promote a user to moderator
  app.patch('/users/moderator/:id', async (req, res) => {
    const userId = req.params.id;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).send({ message: 'Invalid user ID format' });
    }

    try {
      const result = await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role: 'moderator' } }
      );

      if (result.modifiedCount > 0) {
        res.json({ message: 'User promoted to moderator successfully' });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      console.error('Error promoting user to moderator:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

   // Endpoint to update user subscription status
   app.patch('/users/subscribe/:id', async (req, res) => {
    const userId = req.params.id;

    if (!ObjectId.isValid(userId)) {
        return res.status(400).send({ message: 'Invalid user ID format' });
    }

    try {
        const result = await userCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { subscriptionStatus: 'verified' } } // Store verified status
        );

        if (result.modifiedCount > 0) {
            res.json({ message: 'User subscription status updated successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating subscription status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

    app.get('/users/role/:email', async (req, res) => {
      const user = await userCollection.findOne({ email: req.params.email });
      res.json({ role: user?.role || "user" });
    });

  } finally {
    // Do not close the connection, keep the server running
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello, Product Hunt Server is running...');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});