import express from 'express'


const NotificationRouter = express.Router()

NotificationRouter.post('/notify_all_users', notifyAllUsers);
NotificationRouter.post('/notify_one/:token', notifyOneUser);