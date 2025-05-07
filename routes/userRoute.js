import express from 'express';
import { superAdminLogin, registerMember, sendVerificationEmail, verifyUser, sendForgotPasswordCode, recoverPassword, updateProfile, login } from '../controllers/userController.js';
import auth from '../middlewares/auth.js';

const userRouter = express.Router();

userRouter.post('/super-admin', superAdminLogin);
userRouter.post('/register', registerMember);
userRouter.post('/login', login);
userRouter.post('/send-verification-email', auth, sendVerificationEmail);
userRouter.post('/verify-user', auth, verifyUser);
userRouter.post('/send-forgot-password-email', sendForgotPasswordCode);
userRouter.post('/recover-password', recoverPassword);
userRouter.put('/update-profile', auth, updateProfile);

export default userRouter;