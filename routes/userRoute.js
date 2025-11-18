import express from "express";
import {
  superAdminLogin,
  registerMember,
  sendVerificationEmail,
  verifyUser,
  sendForgotPasswordCode,
  recoverPassword,
  updateProfile,
  login,
  getUserData,
  getUserList,
  updateMembershipStatus,
} from "../controllers/userController.js";
//import { registerForEvent } from "../controllers/eventController.js";
import auth from "../middlewares/auth.js";
import adminAuth from "../middlewares/adminAuth.js";
import {
  sendPadStatementEmail,
  downloadPadStatementPDF,
  downloadPadStatementById,
  listPadStatementHistory,
  sendInvoiceEmail,
  downloadInvoicePDF,
  downloadInvoiceById,
  listInvoiceHistory,
} from "../controllers/notificationController.js";
import { uploadPadStatementPdf } from "../middlewares/multer.js";

const userRouter = express.Router();

userRouter.post("/super-admin", superAdminLogin);
userRouter.post("/register", registerMember);
userRouter.post("/login", login);
userRouter.post("/send-verification-email", auth, sendVerificationEmail);
userRouter.post("/verify-user", auth, verifyUser);
userRouter.post("/send-forgot-password-email", sendForgotPasswordCode);
userRouter.post("/recover-password", recoverPassword);
userRouter.put("/update-profile", auth, updateProfile);
userRouter.post("/get-user-data", getUserData);
userRouter.post("/get-user-list", adminAuth, getUserList);
userRouter.post(
  "/update-membership-status/:id",
  adminAuth,
  updateMembershipStatus
);
// Pad statement endpoints
userRouter.post("/pad/send", adminAuth, sendPadStatementEmail);
userRouter.post(
  "/pad/download",
  adminAuth,
  (req, res, next) => {
    uploadPadStatementPdf(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  downloadPadStatementPDF
);
userRouter.get("/pad/download/:id", adminAuth, downloadPadStatementById);
userRouter.get("/pad/history", adminAuth, listPadStatementHistory);

// Invoice endpoints
userRouter.post("/invoice/send", adminAuth, sendInvoiceEmail);
userRouter.post("/invoice/download", adminAuth, downloadInvoicePDF);
userRouter.get("/invoice/download/:id", adminAuth, downloadInvoiceById);
userRouter.get("/invoice/history", adminAuth, listInvoiceHistory);
//userRouter.post("/get-user-data-admin", adminAuth, getUserData);
//userRouter.post("/register-for-event/:id", auth, registerForEvent);

export default userRouter;
