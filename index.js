const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
app.use(cors());
app.use(express.json());

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
        res
          .status(500)
          .send({
            error: "Failed to retrieve parcels",
            details: error.message,
          });
      }
    });
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
