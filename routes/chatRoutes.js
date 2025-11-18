import { getChatMessages } from "../controllers/chatController.js";
import express from "express";
import adminAuth from "../middlewares/adminAuth.js";

const chatRoutes = express.Router();

chatRoutes.post("/get_chat_messages", adminAuth, getChatMessages);

export default chatRoutes;
