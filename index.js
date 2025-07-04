const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
app.use(
  cors({
    origin: ["http://localhost:5173", "https://simple-auth-2f984.web.app"],
    credentials: true,
  })
);
app.use(cookieParser());
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

const verifyYourSecretToken = (req, res, next) => {
  const getTokenFromCooike = req.cookies.YourSecretToken;
  if (!getTokenFromCooike) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(getTokenFromCooike, process.env.JWT_SECRET, (err, decode) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decode;
    next();
  });
};

async function run() {
  try {
    const proFastUserCollection = client.db("profast").collection("users");
    const profastPercelCollection = client.db("profast").collection("parcel");
    const paymentCollection = client.db("profast").collection("payment");
    const proFastRiderCollection = client.db("profast").collection("riders");
    const proFastPercelTraking = client.db("profast").collection("tracking");
    // addmin verify middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await proFastUserCollection.findOne({ email });
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // rider verify
    const verifyRider = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await proFastUserCollection.findOne({ email });
      if (!user || user.role !== "rider") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // get all user info for admin
    app.get("/user", verifyYourSecretToken, verifyAdmin, async (req, res) => {
      try {
        const user = await proFastUserCollection.find().toArray();
        res.send(user);
      } catch (error) {
        res.status(500).send({
          error: "Failed to retrieve user information",
          details: error.message,
        });
      }
    });
    // get  information
    app.get("/user/:email", verifyYourSecretToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await proFastUserCollection.findOne({ email: email });
        res.send(user);
      } catch (error) {
        res.status(500).send({
          error: "Failed to retrieve user information",
          details: error.message,
        });
      }
    });
    // cerate a json wbtoken
    app.post("/jsonwebtoken", async (req, res) => {
      // register user with the user emial or uid that is store on db
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.JWT_SECRET, {
        expiresIn: "8h",
      });
      res.cookie("YourSecretToken", token, {
        httpOnly: true,
        // change it when live link
        secure: true,
        sameSite: "none",
      });
      res.send({ message: "your cooike is set " });
    });
    // get user all send parcel data
    app.get("/parcels", verifyYourSecretToken, async (req, res) => {
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
    app.get("/parcels/:id", verifyYourSecretToken, async (req, res) => {
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
    app.get("/myPayments", verifyYourSecretToken, async (req, res) => {
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
    // get all rider application
    app.get("/riders", verifyYourSecretToken, async (req, res) => {
      const status = req.query.status;
      const query = {};
      if (status === "approved") {
        query.rider_status = "approved";
      } else if (status === "pending") {
        query.rider_status = "pending";
      } else if (status === "rejected") {
        query.rider_status = "rejected";
      }
      try {
        const applications = await proFastRiderCollection.find(query).toArray();
        res.send(applications);
      } catch (error) {
        res.status(500).send({
          error: "Failed to retrieve rider applications",
          details: error.message,
        });
      }
    });
    // get all percel which is paid but not collected
    // GET /admin/assignable-parcels
    app.get(
      "/admin/assignableParcels",
      verifyYourSecretToken,
      verifyAdmin,
      async (req, res) => {
        try {
          // 2️⃣ Query for paid & not collected
          const query = {
            payment_status: "paid",
            delivery_status: "not_collected",
          };

          const parcels = await profastPercelCollection
            .find(query)
            .sort({ creation_date: 1 })
            .toArray();

          res.send(parcels);
        } catch (error) {
          console.error("Error fetching assignable parcels:", error);
          res.status(500).send({ error: "Failed to retrieve parcels" });
        }
      }
    );
    // get all availavle rider who is available in sender distirct
    app.get(
      "/admin/riders/available",
      verifyYourSecretToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { sender_center } = req.query;
          if (!sender_center) {
            return res
              .status(400)
              .send({ error: "Missing sender_center in query" });
          }

          const query = {
            warehouse: sender_center,
            rider_status: "approved",
          };

          const riders = await proFastRiderCollection.find(query).toArray();

          res.send(riders);
        } catch (error) {
          console.error("Error getting available riders:", error);
          res.status(500).send({ error: "Failed to get riders" });
        }
      }
    );
    // // GET: Get pending delivery tasks for a rider
    app.get(
      "/rider/percels/:riderEmail",
      verifyYourSecretToken,
      verifyRider,
      async (req, res) => {
        const riderEmail = req.params.riderEmail;
        if (!riderEmail) {
          return res.send({ message: "rider email is reuired" });
        }
        const filter = {
          assigned_rider_email: riderEmail,
          delivery_status: { $in: ["assigned_to_rider", "in_transit"] },
        };
        const option = {
          sort: { assigned_date: -1 },
        };
        const result = await profastPercelCollection
          .find(filter, option)
          .toArray();
        res.send(result);
      }
    );
    // get rider compled delivery for a rider
    app.get(
      "/rider/completedPercel/:riderEmail",
      verifyYourSecretToken,
      verifyRider,
      async (req, res) => {
        const riderEmail = req.params.riderEmail;
        if (!riderEmail) {
          return res.send({ message: "rider email is reuired" });
        }
        const filter = {
          assigned_rider_email: riderEmail,
          delivery_status: { $in: ["delivered", "service_center_delivered"] },
        };
        const option = {
          sort: { assigned_date: -1 },
        };
        const result = await profastPercelCollection
          .find(filter, option)
          .toArray();
        res.send(result);
      }
    );
    // find the user percel eith tracking id
    // Assuming Express + MongoDB setup
    app.get(
      "/tracking/:trackingId",
      verifyYourSecretToken,
      async (req, res) => {
        try {
          const trackingId = req.params.trackingId;
          const result = await proFastPercelTraking.findOne({
            tracking_id: trackingId,
          });

          if (!result) {
            return res.status(404).send({ message: "Tracking ID not found" });
          }

          res.send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "Failed to fetch tracking data" });
        }
      }
    );
    // get user all status unog mongoDB agrigate
    app.get("/dashboard/user", verifyYourSecretToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ error: "Email is required" });
        }

        const pipeline = [
          // 1️⃣ Match only parcels created by this user
          { $match: { created_by: email } },

          // 2️⃣ Break into multiple parallel pipelines
          {
            $facet: {
              // Total parcels sent by this user
              totalParcels: [{ $count: "count" }],

              // Sum of cost of *paid* parcels only
              totalSpent: [
                { $match: { payment_status: "paid" } },
                { $group: { _id: null, total: { $sum: "$cost" } } },
              ],

              // How many delivered
              delivered: [
                { $match: { delivery_status: "delivered" } },
                { $count: "count" },
              ],

              // How many pending (anything not delivered)
              pending: [
                { $match: { delivery_status: { $ne: "delivered" } } },
                { $count: "count" },
              ],

              // Latest 5 parcels for user dashboard
              recentParcels: [{ $sort: { creation_date: -1 } }, { $limit: 5 }],
            },
          },
        ];

        // Run the aggregation
        const [result] = await profastPercelCollection
          .aggregate(pipeline)
          .toArray();

        // Respond with simplified data structure
        res.send({
          totalParcels: result.totalParcels[0]?.count || 0,
          totalSpent: result.totalSpent[0]?.total || 0,
          delivered: result.delivered[0]?.count || 0,
          pending: result.pending[0]?.count || 0,
          recentParcels: result.recentParcels || [],
        });
      } catch (error) {
        console.error("Error in /user/dashboard:", error);
        res
          .status(500)
          .send({ error: "Internal Server Error", details: error.message });
      }
    });
    // make admin dashboard
    /**
     * Admin Dashboard Aggregated Stats
     * - Must be called by an authenticated, verified admin
     */
    app.get(
      "/dashboard/admin",
      verifyYourSecretToken,
      verifyAdmin,
      async (req, res) => {
        try {
          // ----------- 1️⃣ Define the date ranges -------------
          // Start of today (00:00)
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Start of this week (Sunday)
          const startOfWeek = new Date();
          startOfWeek.setDate(today.getDate() - today.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          // Start of this month (1st of month)
          const startOfMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          );

          // Start of this year (January 1st)
          const startOfYear = new Date(today.getFullYear(), 0, 1);

          // ----------- 2️⃣ MongoDB Aggregation Pipeline -------------
          const pipeline = [
            {
              $facet: {
                // Total parcels in system
                totalParcels: [{ $count: "count" }],

                // Total parcels with payment status "paid"
                totalPaidParcels: [
                  { $match: { payment_status: "paid" } },
                  { $count: "count" },
                ],

                // Sum of cost of all paid parcels = total revenue
                totalEarnings: [
                  { $match: { payment_status: "paid" } },
                  { $group: { _id: null, total: { $sum: "$cost" } } },
                ],

                // How many parcels are unassigned (no rider yet)
                unassignedParcels: [
                  { $match: { assigned_rider_email: { $exists: false } } },
                  { $count: "count" },
                ],

                // How many are in transit
                inTransit: [
                  { $match: { delivery_status: "in_transit" } },
                  { $count: "count" },
                ],

                // How many have been delivered
                delivered: [
                  { $match: { delivery_status: "delivered" } },
                  { $count: "count" },
                ],

                // Last 5 parcels for recent activity table
                recentParcels: [
                  { $sort: { creation_date: -1 } },
                  { $limit: 5 },
                ],

                // Earnings *today*
                todayEarnings: [
                  {
                    $match: {
                      payment_status: "paid",
                      assigned_date: { $gte: today },
                    },
                  },
                  {
                    $group: { _id: null, total: { $sum: "$cost" } },
                  },
                ],

                // Earnings this *week*
                weekEarnings: [
                  {
                    $match: {
                      payment_status: "paid",
                      assigned_date: { $gte: startOfWeek },
                    },
                  },
                  {
                    $group: { _id: null, total: { $sum: "$cost" } },
                  },
                ],

                // Earnings this *month*
                monthEarnings: [
                  {
                    $match: {
                      payment_status: "paid",
                      assigned_date: { $gte: startOfMonth },
                    },
                  },
                  {
                    $group: { _id: null, total: { $sum: "$cost" } },
                  },
                ],

                // Earnings this *year*
                yearEarnings: [
                  {
                    $match: {
                      payment_status: "paid",
                      assigned_date: { $gte: startOfYear },
                    },
                  },
                  {
                    $group: { _id: null, total: { $sum: "$cost" } },
                  },
                ],
              },
            },
          ];

          // ----------- 3️⃣ Run the aggregation -------------
          const [result] = await profastPercelCollection
            .aggregate(pipeline)
            .toArray();

          // ----------- 4️⃣ Format and send response -------------
          res.send({
            totalParcels: result.totalParcels[0]?.count || 0,
            totalPaidParcels: result.totalPaidParcels[0]?.count || 0,
            totalEarnings: result.totalEarnings[0]?.total || 0,
            unassignedParcels: result.unassignedParcels[0]?.count || 0,
            inTransit: result.inTransit[0]?.count || 0,
            delivered: result.delivered[0]?.count || 0,
            recentParcels: result.recentParcels || [],
            todayEarnings: result.todayEarnings[0]?.total || 0,
            weekEarnings: result.weekEarnings[0]?.total || 0,
            monthEarnings: result.monthEarnings[0]?.total || 0,
            yearEarnings: result.yearEarnings[0]?.total || 0,
          });
        } catch (err) {
          console.error(err);
          res.status(500).send({ error: "Server error" });
        }
      }
    );

    // send parcel
    app.post("/addParcel", verifyYourSecretToken, async (req, res) => {
      try {
        const parcel = req.body;
        const result = await profastPercelCollection.insertOne(parcel);
        // Add initial tracking log
        await proFastPercelTraking.insertOne({
          tracking_id: parcel.tracking_id,
          logs: [
            {
              status: "created",
              details: `Parcel created by ${parcel.sender_name}`,
              date: new Date(),
            },
          ],
        });
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
    app.post("/payments", verifyYourSecretToken, async (req, res) => {
      try {
        const paymentInfo = req.body;
        const result = await paymentCollection.insertOne(paymentInfo);
        await proFastPercelTraking.updateOne(
          { tracking_id: paymentInfo.traking_id },
          {
            $push: {
              logs: {
                status: "paid",
                details: "Payment received",
                date: new Date(),
              },
            },
          }
        );
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: "Faild to add payment", details: error.message });
      }
    });
    // to add rider application
    app.post("/riders", verifyYourSecretToken, async (req, res) => {
      try {
        const riderData = req.body;
        const result = await proFastRiderCollection.insertOne(riderData);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          error: "Failed to add rider application",
          details: error.message,
        });
      }
    });
    // resigster the user
    app.post("/register", async (req, res) => {
      const userInformation = req.body;
      const { email } = userInformation;
      const query = { email: email };
      const existingUser = await proFastUserCollection.findOne(query);
      if (existingUser) {
        return res.status(200).send({ message: "User already exists" });
      }
      const result = await proFastUserCollection.insertOne(userInformation);
      res.send(result);
    });
    // update the payment status for the parcel
    app.patch("/parcel/:id", verifyYourSecretToken, async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(id) };
      const result = await profastPercelCollection.updateOne(filter, {
        $set: updateData,
      });
      res.send(result);
    });
    // update the rider status
    app.patch(
      "/updateRiderStatus/:id",
      verifyYourSecretToken,
      async (req, res) => {
        const id = req.params.id;
        const status = req.query.status;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            rider_status: status,
          },
        };
        const result = await proFastRiderCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );
    // update the user role and the last logint time
    app.patch("/login", async (req, res) => {
      const { email, lastSignInTime } = req.body;
      console.log(email, lastSignInTime);
      const filter = { email: email };
      const updateDoc = {
        $set: {
          lastSignInTime: lastSignInTime,
        },
      };
      const result = await proFastUserCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // make a user admin to user or user to admin
    app.patch(
      "/user/:id/role",
      verifyYourSecretToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const userId = req.params.id;
          const { role } = req.body;
          // ✅ Validate incoming data
          if (
            !role ||
            (role !== "admin" && role !== "user" && role !== "rider")
          ) {
            return res.status(400).json({ error: "Invalid role" });
          }

          // ✅ Convert string ID to ObjectId
          const filter = { _id: new ObjectId(userId) };
          const updateDoc = { $set: { role } };

          // ✅ Update the user in the database
          const result = await proFastUserCollection.updateOne(
            filter,
            updateDoc
          );

          if (result.matchedCount === 0) {
            return res.status(404).json({ error: "User not found" });
          }

          res.send(result);
        } catch (error) {
          console.error("Error updating user role:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      }
    );
    // update the user delevery status and collection
    // PATCH: Assign rider to parcel (Admin only)
    app.patch(
      "/admin/parcels/:parcelId/assign",
      verifyYourSecretToken,
      verifyAdmin,
      async (req, res) => {
        try {
          // 1. Check admin role

          const parcelId = req.params.parcelId;
          const { riderEmail, riderName } = req.body;
          if (!riderEmail || !riderName) {
            return res
              .status(400)
              .send({ error: "Missing riderId or riderName" });
          }

          // 2. Update parcel with rider info
          const result = await profastPercelCollection.updateOne(
            { _id: new ObjectId(parcelId) },
            {
              $set: {
                assigned_rider_email: riderEmail,
                assigned_rider_name: riderName,
                delivery_status: "assigned_to_rider",
                assigned_date: new Date(),
              },
            }
          );

          if (result.modifiedCount === 0) {
            return res
              .status(404)
              .send({ error: "Parcel not found or already assigned" });
          }
          const findThePercel = await profastPercelCollection.findOne({
            _id: new ObjectId(parcelId),
          });
          await proFastPercelTraking.updateOne(
            { tracking_id: findThePercel.tracking_id },
            {
              $push: {
                logs: {
                  status: "ridder assign",
                  details: "Riddes Assign",
                  date: new Date(),
                },
              },
            }
          );

          res.send(result);
        } catch (error) {
          console.error("Error assigning rider:", error);
          res.status(500).send({ error: "Internal Server Error" });
        }
      }
    );
    // update delivery status form rider
    app.patch(
      "/parcels/:id/status",
      verifyYourSecretToken,
      verifyRider,
      async (req, res) => {
        const parcelId = req.params.id;
        const { status } = req.body;
        const updatedDoc = {
          delivery_status: status,
        };

        if (status === "in_transit") {
          updatedDoc.picked_at = new Date().toISOString();
          const findThePercel = await profastPercelCollection.findOne({
            _id: new ObjectId(parcelId),
          });
          await proFastPercelTraking.updateOne(
            { tracking_id: findThePercel.tracking_id },
            {
              $push: {
                logs: {
                  status: "in transit",
                  details: "Your Percel On The way",
                  date: new Date(),
                },
              },
            }
          );
        } else if (status === "delivered") {
          updatedDoc.delivered_at = new Date().toISOString();
          const findThePercel = await profastPercelCollection.findOne({
            _id: new ObjectId(parcelId),
          });
          await proFastPercelTraking.updateOne(
            { tracking_id: findThePercel.tracking_id },
            {
              $push: {
                logs: {
                  status: "delivired",
                  details: "Percel Is delivaried",
                  date: new Date(),
                },
              },
            }
          );
        }

        try {
          const result = await profastPercelCollection.updateOne(
            { _id: new ObjectId(parcelId) },
            {
              $set: updatedDoc,
            }
          );
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to update status" });
        }
      }
    );
    // update the percel cash out status from rider
    app.patch(
      "/completedPercel/:id/cashOut",
      verifyYourSecretToken,
      verifyRider,
      async (req, res) => {
        const parcelId = req.params.id;

        try {
          const filter = { _id: new ObjectId(parcelId) };
          const updateDoc = {
            $set: {
              cashout_status: "cashed_out",
              cashed_out_at: new Date(),
            },
          };
          const result = await profastPercelCollection.updateOne(
            filter,
            updateDoc
          );
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to update status" });
        }
      }
    );
    // delete userpercel
    app.delete("/deleteParcel/:id", verifyYourSecretToken, async (req, res) => {
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
