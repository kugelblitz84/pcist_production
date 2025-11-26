import express from "express";
import { uploadEventImages, compressImages } from "../middlewares/multer.js";
import {
  addEvent,
  getEvents,
  GetOneEventUsingId,
  updateEvent,
  deleteEvent,
  registerForSoloEvent,
  registerForTeamEvent,
  getRegisteredTeamList,
  getRegisteredMembersList,
  uploadImagesToGallery,
  fetchGalleryImages,
  updatePayment
} from "../controllers/eventController.js";
import adminAuth from "../middlewares/adminAuth.js";
import auth from "../middlewares/auth.js";
import validateRequest from "../middlewares/validateRequest.js";
import { eventSchemas, commonSchemas } from "../validators/index.js";

const eventRoutes = express.Router();

eventRoutes.post(
  "/add_event",
  uploadEventImages,
  compressImages,
  validateRequest({ body: eventSchemas.addEvent }),
  adminAuth,
  addEvent
);
eventRoutes.get("/get_all_event", getEvents);
eventRoutes.get(
  "/get_one_event/:id",
  validateRequest({ params: commonSchemas.objectIdParam }),
  GetOneEventUsingId
);
eventRoutes.put(
  "/update_event/:id",
  validateRequest({
    params: commonSchemas.objectIdParam,
    body: eventSchemas.updateEvent,
  }),
  adminAuth,
  updateEvent
);
eventRoutes.post(
  "/delete_event/:id",
  validateRequest({
    params: commonSchemas.objectIdParam,
    body: eventSchemas.deleteEvent,
  }),
  adminAuth,
  deleteEvent
);
eventRoutes.post(
  "/upload_images_to_gallery",
  uploadEventImages,
  compressImages,
  validateRequest({ body: eventSchemas.uploadGallery }),
  adminAuth,
  uploadImagesToGallery
);
eventRoutes.get("/fetch_gallery_images", fetchGalleryImages);
eventRoutes.post(
  "/register_for_solo_event/:id",
  validateRequest({
    params: eventSchemas.registerParams,
    body: eventSchemas.registerSolo,
  }),
  auth,
  registerForSoloEvent
); //event id in params
eventRoutes.post(
  "/register_for_team_event/:id",
  validateRequest({
    params: eventSchemas.registerParams,
    body: eventSchemas.registerTeam,
  }),
  auth,
  registerForTeamEvent
);
eventRoutes.get(
  "/get_registered_teams/:id",
  validateRequest({ params: commonSchemas.objectIdParam }),
  getRegisteredTeamList
);
eventRoutes.get(
  "/get_registered_members/:id",
  validateRequest({ params: commonSchemas.objectIdParam }),
  getRegisteredMembersList
);
// Update payment status of members for an event (solo or team); admin protected
eventRoutes.post(
  "/update_payment/:id",
  validateRequest({
    params: commonSchemas.objectIdParam,
    body: eventSchemas.updatePayment,
  }),
  adminAuth,
  updatePayment
);
export default eventRoutes;

//done
