import { getChatMessages } from "../controllers/chatController.js";
import express from "express";
import adminAuth from "../middlewares/adminAuth.js";
import validateRequest from "../middlewares/validateRequest.js";
import { chatSchemas } from "../validators/index.js";

const chatRoutes = express.Router();

chatRoutes.post(
	"/get_chat_messages",
	validateRequest({ body: chatSchemas.getMessages }),
	adminAuth,
	getChatMessages
);

export default chatRoutes;
