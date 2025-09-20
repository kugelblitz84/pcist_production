import express from "express";
import cors from "cors";
import userRouter from "./routes/userRoute.js";
import eventRoutes from "./routes/eventRoutes.js";
import NotificationRouter from "./routes/notificationsRoutes.js";
import chatRoutes from "./routes/chatRoutes.js"; 
import mongoSanitize from "express-mongo-sanitize";
import mongoose from "mongoose";
const app = express();

// middlewares
app.use(express.json());
app.use(cors());
app.use(mongoSanitize());
// Extra safety: strip $ and . from any query filter paths
mongoose.set('sanitizeFilter', true);

// auth route
app.use("/api/v1/user", userRouter);
app.use("/api/v1/event", eventRoutes);
app.use("/api/v1/notification", NotificationRouter);
app.use("/api/v1/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("API update Working");
});

export default app;