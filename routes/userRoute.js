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
import validateRequest from "../middlewares/validateRequest.js";
import {
  userSchemas,
  padSchemas,
  invoiceSchemas,
  commonSchemas,
} from "../validators/index.js";

const userRouter = express.Router();

const handlePadPdfUpload = (req, res, next) => {
  uploadPadStatementPdf(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next();
  });
};

userRouter.post(
  "/super-admin",
  validateRequest({ body: userSchemas.superAdminLogin }),
  superAdminLogin
);
userRouter.post(
  "/register",
  validateRequest({ body: userSchemas.register }),
  registerMember
);
userRouter.post(
  "/login",
  validateRequest({ body: userSchemas.login }),
  login
);
userRouter.post(
  "/send-verification-email",
  validateRequest({ body: userSchemas.slugOnly }),
  auth,
  sendVerificationEmail
);
userRouter.post(
  "/verify-user",
  validateRequest({ body: userSchemas.verifyUser }),
  auth,
  verifyUser
);
userRouter.post(
  "/send-forgot-password-email",
  validateRequest({ body: userSchemas.forgotPassword }),
  sendForgotPasswordCode
);
userRouter.post(
  "/recover-password",
  validateRequest({ body: userSchemas.recoverPassword }),
  recoverPassword
);
userRouter.put(
  "/update-profile",
  validateRequest({ body: userSchemas.updateProfile }),
  auth,
  updateProfile
);
userRouter.post(
  "/get-user-data",
  validateRequest({ body: userSchemas.getUserData }),
  getUserData
);
userRouter.post(
  "/get-user-list",
  validateRequest({ body: userSchemas.slugOnly }),
  adminAuth,
  getUserList
);
userRouter.post(
  "/update-membership-status/:id",
  validateRequest({
    params: commonSchemas.objectIdParam,
    body: userSchemas.updateMembership,
  }),
  adminAuth,
  updateMembershipStatus
);
// Pad statement endpoints
userRouter.post(
  "/pad/send",
  validateRequest({ body: padSchemas.send }),
  adminAuth,
  sendPadStatementEmail
);
userRouter.post(
  "/pad/download",
  handlePadPdfUpload,
  validateRequest({ body: padSchemas.download }),
  adminAuth,
  downloadPadStatementPDF
);
userRouter.get(
  "/pad/download/:id",
  validateRequest({ params: commonSchemas.objectIdParam }),
  adminAuth,
  downloadPadStatementById
);
userRouter.get("/pad/history", adminAuth, listPadStatementHistory);

// Invoice endpoints
userRouter.post(
  "/invoice/send",
  validateRequest({ body: invoiceSchemas.send }),
  adminAuth,
  sendInvoiceEmail
);
userRouter.post(
  "/invoice/download",
  validateRequest({ body: invoiceSchemas.download }),
  adminAuth,
  downloadInvoicePDF
);
userRouter.get(
  "/invoice/download/:id",
  validateRequest({ params: commonSchemas.objectIdParam }),
  adminAuth,
  downloadInvoiceById
);
userRouter.get("/invoice/history", adminAuth, listInvoiceHistory);

export default userRouter;
