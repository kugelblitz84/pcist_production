import express from 'express';
import { setProctor, setExam } from '../controllers/proctorController';
import proctorAuth from '../middleware/proctorAuth';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

router.post('/setProctor/:userId', adminAuth, setProctor);
router.post('/setExam', proctorAuth, setExam);

export default router;