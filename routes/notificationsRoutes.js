import express from 'express'
import { notifyAllUsers, notifyOneUser, sendPadStatementEmail, sendInvoiceEmail } from '../controllers/notificationController.js';
import adminAuth from '../middlewares/adminAuth.js';

const NotificationRouter = express.Router()

NotificationRouter.post('/notify_all_users', adminAuth, notifyAllUsers);
NotificationRouter.post('/notify_one/:token', adminAuth,  notifyOneUser);
NotificationRouter.post('/send_pad_statement', sendPadStatementEmail);
NotificationRouter.post('/send_invoice', sendInvoiceEmail);

export default NotificationRouter;