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
    let eventType = "solo";
    let event = await soloEvents.findById(eventID);
    if (!event) {
      event = await teamEvents.findById(eventID);
      eventType = "team";
      if (!event) {
        return res.status(404).json({ message: "No Event Found" });
      }
    }

    return res.status(200).json({
      eventType: eventType,
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

    let deletedEvent = await soloEvents.findByIdAndDelete(eventId);
    if (!deletedEvent) {
      deletedEvent = await teamEvents.findByIdAndDelete(eventId);
    }

    if (!deletedEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.status(200).json({
      message: "Event deleted successfully",
      data: deletedEvent,
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

    // fetch user for classroll
    const regUser = await userModel.findById(userId);
    const classroll = regUser ? regUser.classroll : undefined;

    event.registeredMembers.push({
      userId,
      classroll,
      Name,
      paymentStatus: false,
    });
    await event.save();

  // Participation is now recorded only after successful payment (see updatePayment controller)

    res.status(200).json({ message: "Registered for event" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};


const registerForTeamEvent = async (req, res) => {
  try {
  const eventId = req.params.id;
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
        classroll: user.classroll,
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
  const eventId = req.params.id;
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
  const eventId = req.params.id;
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

// Update payment status for members (solo or team events)
// Request: POST /update_payment/:id  { members: ["userId1", "userId2"], paymentStatus?: true|false }
// Optionally each members entry can be an object: { userId: "...", status: true }
const updatePayment = async (req, res) => {
  try {
    const eventId = req.params.id;
    const { members, paymentStatus: globalPaymentStatus } = req.body;
    // Members must be a non-empty array
    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "members array is required" });
    }

    // Fetch event (solo first, then team)
    let eventType = 'solo';
    let event = await soloEvents.findById(eventId);
    if (!event) {
      event = await teamEvents.findById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      eventType = 'team';
    }

    // Prepare resolved member targets with userId + desired status
    // Support shapes: string (userId), { userId, status }, { classroll, status }
    // If globalPaymentStatus provided, override individual status requirements
    const resolved = [];
    for (const m of members) {
      // Plain string userId case
      if (typeof m === 'string') {
        if (globalPaymentStatus == null) {
          return res.status(400).json({ message: "Each member object must include status when global paymentStatus is not provided" });
        }
        resolved.push({ userId: m, status: !!globalPaymentStatus });
        continue;
      }
      if (typeof m !== 'object' || m === null) {
        return res.status(400).json({ message: "Invalid member entry" });
      }
      const { userId, classroll } = m;
      let status = globalPaymentStatus != null ? !!globalPaymentStatus : m.status;
      if (status == null) {
        return res.status(400).json({ message: "Member status missing and no global paymentStatus provided" });
      }
      if (userId && classroll) {
        return res.status(400).json({ message: "Provide either userId or classroll, not both" });
      }
      let finalUserId = userId;
      if (!finalUserId && classroll != null) {
        const userDoc = await userModel.findOne({ classroll: classroll });
        if (!userDoc) {
          return res.status(404).json({ message: `User with classroll ${classroll} not found` });
        }
        finalUserId = userDoc._id.toString();
      }
      if (!finalUserId) {
        return res.status(400).json({ message: "Member must include userId or classroll" });
      }
      resolved.push({ userId: finalUserId.toString(), status: !!status });
    }

    // Deduplicate keeping last status occurrence
    const statusMap = new Map(); // userId -> status
    resolved.forEach(r => statusMap.set(r.userId, r.status));
    const userIdList = Array.from(statusMap.keys());

    let updatedCount = 0;

    if (eventType === 'solo') {
      // Load event doc (already have) and update inline for potential mixed statuses
      let modified = false;
      for (const member of event.registeredMembers) {
        const uid = member.userId.toString();
        if (statusMap.has(uid)) {
          const newStatus = statusMap.get(uid);
            if (member.paymentStatus !== newStatus) {
              member.paymentStatus = newStatus;
              modified = true;
              updatedCount++;
            }
        }
      }
      if (modified) await event.save();
    } else {
      // Team event: if all statuses identical we can use fast bulk update; else mutate document
      const uniqueStatuses = new Set(statusMap.values());
      if (uniqueStatuses.size === 1) {
        const unifiedStatus = uniqueStatuses.values().next().value;
        const result = await teamEvents.updateOne(
          { _id: eventId },
          { $set: { "registeredTeams.$[].members.$[member].paymentStatus": unifiedStatus } },
          { arrayFilters: [ { "member.userId": { $in: userIdList } } ] }
        );
        updatedCount = result.modifiedCount || 0;
        // Need fresh event doc for participation additions
        event = await teamEvents.findById(eventId);
      } else {
        // Mixed statuses; mutate document in memory
        let modified = false;
        for (const team of event.registeredTeams) {
          for (const mem of team.members) {
            const uid = mem.userId.toString();
            if (statusMap.has(uid)) {
              const desired = statusMap.get(uid);
              if (mem.paymentStatus !== desired) {
                mem.paymentStatus = desired;
                modified = true;
                updatedCount++;
              }
            }
          }
        }
        if (modified) await event.save();
      }
    }

    // After updating payment statuses, add participations for those now true
    // (We do not remove participations when status flips to false per current requirement)
    const paidUserIds = userIdList.filter(uid => statusMap.get(uid) === true);
    for (const uid of paidUserIds) {
      const user = await userModel.findById(uid);
      if (!user) continue;
      if (!user.myParticipations || Array.isArray(user.myParticipations)) {
        user.myParticipations = { solo: [], team: [] };
      } else {
        user.myParticipations.solo = user.myParticipations.solo || [];
        user.myParticipations.team = user.myParticipations.team || [];
      }
      if (eventType === 'solo') {
        const exists = user.myParticipations.solo.some(p => p.eventId && p.eventId.toString() === event._id.toString());
        if (!exists) {
          user.myParticipations.solo.push({ eventId: event._id, eventName: event.eventName });
          await user.save();
        }
      } else {
        const exists = user.myParticipations.team.some(p => p.eventId && p.eventId.toString() === event._id.toString());
        if (!exists) {
          user.myParticipations.team.push({ eventId: event._id, eventName: event.eventName });
          await user.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment status updated',
      eventType,
      eventId,
      updatedCount
    });
  } catch (err) {
    console.error('updatePayment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
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
  fetchGalleryImages,
  updatePayment
};
