import express from 'express'
import auth from '../middlewares/auth.js';
import eventController from '../controllers/eventController.js'
import adminAuth from '../middlewares/adminAuth.js';
const {addEvent, getEvents, GetOneEventUsingId, updateEvent, deleteEvent} = eventController

const eventRoutes = express.Router()

eventRoutes.post('/add_event', adminAuth, addEvent)
eventRoutes.get('/get_all_event', getEvents)
eventRoutes.get('/get_one_event/:id', GetOneEventUsingId)
eventRoutes.put('/update_event/:id', adminAuth, updateEvent)
eventRoutes.delete('/delete_event/:id', adminAuth, deleteEvent)

export default eventRoutes;