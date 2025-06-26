const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
app.use(cors());
app.use(express.json());
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.kn8r7rw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
app.get("/", (req, res) => {
  res.send("Hello server");
});
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const profastPercelCollection = client.db("profast").collection("parcel");
    const paymentCollection = client.db("profast").collection("payment");
    // get user all send parcel data
    app.get("/parcels", async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};
        if (email) {
          query = { created_by: email };
        }
        const parcels = await profastPercelCollection.find(query).toArray();
        res.send(parcels);
      } catch (error) {
        res.status(500).send({
          error: "Failed to retrieve parcels",
          details: error.message,
        });
      }
    });
    // to view a single parcel details
    app.get("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const parcel = await profastPercelCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(parcel);
      } catch (error) {
        res.status(500).send({
          error: "Failed to retrieve parcel",
          details: error.message,
        });
      }
    });
    // get user all paymnet history
    app.get("/myPayments", async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};
        if (email) {
          query = { email: email };
        }
        const payments = await paymentCollection.find(query).toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).send({
          error: "Failed to retrieve payments",
          details: error.message,
        });
      }
    });
    // send percel
    app.post("/addParcel", async (req, res) => {
      try {
        const parcel = req.body;
        const result = await profastPercelCollection.insertOne(parcel);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: "Failed to add parcel", details: error.message });
      }
    });
    // Create Payment Intent API
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { amount } = req.body;
        // Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount, // amount in cents or paisa
          currency: "usd", // use "usd" or "bdt" if available
          payment_method_types: ["card"],
        });
        // Send clientSecret to frontend
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error.message);
        res.status(500).send({ error: error.message });
      }
    });
    // to store the payment details for sow payment hsitory
    app.post("/payments", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const result = await paymentCollection.insertOne(paymentInfo);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: "Faild to add payment", details: error.message });
      }
    });
    // set payment history

    app.patch("/parcel/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(id) };
      const result = await profastPercelCollection.updateOne(filter, {
        $set: updateData,
      });
      res.send(result);
    });

    app.delete("/deleteParcel/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await profastPercelCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: "Failed to delete parcel", details: error.message });
      }
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  const time = new Date().toLocaleTimeString();
  console.log(`Server is running on ${time} port http://localhost:${port}`);
});
