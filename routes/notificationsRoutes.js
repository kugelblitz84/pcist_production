import express from 'express'
import { notifyAllUsers, notifyOneUser} from '../controllers/notificationController.js';
import adminAuth from '../middlewares/adminAuth.js';
import validateRequest from '../middlewares/validateRequest.js';
import { notificationSchemas } from '../validators/index.js';

const NotificationRouter = express.Router()

NotificationRouter.post(
	'/notify_all_users',
	validateRequest({ body: notificationSchemas.notifyAll }),
	adminAuth,
	notifyAllUsers
);
NotificationRouter.post(
	'/notify_one/:token',
	validateRequest({
		params: notificationSchemas.notifyOneParams,
		body: notificationSchemas.notifyAll,
	}),
	adminAuth,
	notifyOneUser
);


export default NotificationRouter;