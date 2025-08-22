import { soloEvents, teamEvents, eventGallery } from "../models/eventModel.js";
import cloudinary from "../configs/cloudinary.js";
import userModel from "../models/userModel.js";

const addEvent = async (req, res) => {
  try {
    const {
      eventName,
      eventType,
      date,
      registrationDeadline,
      location,
      description,
      needMembership,
    } = req.body;

    const images = req.files;
    console.log(images);
    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        // Upload buffer directly to cloudinary
        // Use a promise to handle the stream upload
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: "image",
              folder: "Event banners",
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve({
                  url: result.secure_url,
                  publicId: result.public_id,
                });
              }
            }
          );

          // Send the buffer to the upload stream
          uploadStream.end(item.buffer);
        });
      })
    );

    const newEventData = {
      eventName,
      date,
      registrationDeadline,
      location,
      description,
      images: imagesUrl,
      needMembership,
    };

    if (eventType === "solo") {
      await soloEvents.create({ ...newEventData, registeredMembers: [] });
    } else if (eventType === "team") {
      await teamEvents.create({ ...newEventData, registeredTeams: [] });
    } else {
      return res.status(400).json({ message: "Invalid event type" });
    }

    res.status(200).json({ message: "New event created" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const solo = await soloEvents.find();
    const team = await teamEvents.find();
    res.status(200).json({
      message: "All current events",
      soloEvents: solo,
      teamEvents: team,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const GetOneEventUsingId = async (req, res) => {
  try {
    const eventID = req.params.id;

    let event = await soloEvents.findById(eventID);
    if (!event) {
      event = await teamEvents.findById(eventID);
      if (!event) {
        return res.status(404).json({ message: "No Event Found" });
      }
    }

    return res.status(200).json({
      message: "Event found",
      data: event,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const { eventName, date, description, location, registrationDeadline } =
      req.body;

    const updateFields = {};
    if (eventName) updateFields.eventName = eventName;
    if (date) updateFields.date = date;
    if (description) updateFields.description = description;
    if (location) updateFields.location = location;
    if (registrationDeadline)
      updateFields.registrationDeadline = registrationDeadline;

    let updatedEvent = await soloEvents.findByIdAndUpdate(
      eventId,
      { $set: updateFields },
      { new: true }
    );
    if (!updatedEvent) {
      updatedEvent = await teamEvents.findByIdAndUpdate(
        eventId,
        { $set: updateFields },
        { new: true }
      );
    }

    if (!updatedEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.status(200).json({
      message: "Event updated successfully",
      data: updatedEvent,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

    // Try solo events first
    let event = await soloEvents.findById(eventId);
    let eventType = "solo";

    if (!event) {
      event = await teamEvents.findById(eventId);
      eventType = "team";
    }

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // If images exist, delete from Cloudinary
    if (event.images && event.images.length > 0) {
      const deletePromises = event.images.map(img =>
        cloudinary.uploader.destroy(img.publicId)
      );
      await Promise.all(deletePromises);
    }

    // Delete event from DB
    if (eventType === "solo") {
      await soloEvents.findByIdAndDelete(eventId);
    } else {
      await teamEvents.findByIdAndDelete(eventId);
    }

    return res.status(200).json({
      message: "Event and its images deleted successfully",
      data: event,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};


const registerForSoloEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;
    const { Name } = req.body;

    const event = await soloEvents.findById(eventId);
    if (event == null) return res.status(404).json({ message: "Event not found" });

    // Check if event requires membership
    if (event.needMembership) {
      const user = await userModel.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Check if user has valid membership
      if (!user.membership) {
        return res.status(403).json({
          message:
            "This event requires membership. Please purchase a membership to register.",
        });
      }

      // Check if membership has expired
      if (user.membershipExpiresAt && new Date() > user.membershipExpiresAt) {
        return res.status(403).json({
          message:
            "Your membership has expired. Please renew your membership to register.",
        });
      }
    }

    if (event.registeredMembers.some((m) => m.userId.toString() === userId)) {
      return res.status(400).json({ message: "Already registered" });
    }

    event.registeredMembers.push({ userId, Name, paymentStatus: false });
    await event.save();

    res.status(200).json({ message: "Registered for event" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const registerForTeamEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { teamName, members } = req.body; // members = ["email1", "email2", "email3"]

    // Validate input
    if (!teamName || !Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ message: "Team name and members are required." });
    }

    // Check registration deadline
    //console.log(eventId);
    const event = await teamEvents.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found." });

    const now = new Date();
    if (now > event.registrationDeadline) {
      return res
        .status(400)
        .json({ message: "Registration deadline has passed." });
    }

    // Check if team name is already registered
    const duplicateTeam = await teamEvents.findOne({
      _id: eventId,
      "registeredTeams.teamName": teamName,
    });

    if (duplicateTeam) {
      return res
        .status(400)
        .json({ message: "Team name already registered for this event." });
    }

    // Process members
    const processedMembers = [];

    for (const email of members) {
      const user = await userModel.findOne({ email: email });
      if (!user) {
        return res
          .status(404)
          .json({ message: `User with email ${email} not found.` });
      }

      // Check membership requirement for this event
      if (event.needMembership) {
        // Check if user has valid membership
        if (!user.membership) {
          return res.status(403).json({
            message: `This event requires membership. User ${email} does not have membership. All team members must have valid membership to register.`,
          });
        }

        // Check if membership has expired
        if (user.membershipExpiresAt && new Date() > user.membershipExpiresAt) {
          return res.status(403).json({
            message: `This event requires membership. User ${email} has expired membership. All team members must have valid membership to register.`,
          });
        }
      }

      // Check if this user is already part of any team in the event
      const alreadyInTeam = await teamEvents.findOne({
        _id: eventId,
        "registeredTeams.members.userId": user._id,
      });

      if (alreadyInTeam) {
        return res
          .status(400)
          .json({ message: `User ${email} is already registered in a team.` });
      }

      processedMembers.push({
        userId: user._id,
        Name: user.name || "", // fallback to empty if name not found
        paymentStatus: false,
      });
    }

    // Add new team
    const newTeam = {
      teamName,
      members: processedMembers,
    };

    event.registeredTeams.push(newTeam);
    await event.save();

    return res.status(200).json({ message: "Team registered successfully." });
  } catch (error) {
    console.error("Register team error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getRegisteredTeamList = async (req, res) => {
  try {
    const { eventId } = req.params.id;
    const event = await teamEvents.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    return res.status(200).json({
      teams: event.registeredTeams,
    });
  } catch (err) {
    return res.status(500).json({ messge: "Internal server error" });
  }
};

const getRegisteredMembersList = async (req, res) => {
  try {
    const { eventId } = req.params.id;
    const event = await soloEvents.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    return res.status(200).json({
      registeredMembers: event.registeredMembers,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const uploadImagesToGallery = async (req, res) => {
  try {
    const images = req.files;
    console.log(images);
    let imagesURL = await Promise.all(
      images.map(async (item) => {
        // Use a promise to handle the stream upload
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: "image",
              folder: "Gallery",
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve({
                  url: result.secure_url,
                  publicId: result.public_id,
                });
              }
            }
          );

          // Send the buffer to the upload stream
          uploadStream.end(item.buffer);
        });
      })
    );
    await eventGallery.create({ images: imagesURL });
    res.status(200).json({ message: "Image(s) uploaded successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error uploading: " + err });
  }
};

// Fetch all uploaded images from the gallery
const fetchGalleryImages = async (req, res) => {
  try {
    // Find all documents in the gallery
    const gallery = await eventGallery.find();

    if (!gallery || gallery.length === 0) {
      return res.status(404).json({ message: "No images found in gallery" });
    }

    // Extract all images
    let allImages = [];
    gallery.forEach((item) => {
      allImages = allImages.concat(item.images);
    });

    res.status(200).json({
      message: "Images fetched successfully",
      images: allImages,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching images: " + err });
  }
};


export {
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
  fetchGalleryImages
};
