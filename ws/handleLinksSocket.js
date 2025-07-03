import { User as userModel } from "../models/userModel.js";
import { redis } from "../utils/redisClient.js";

export const handleLinksSocket = (socket, io) => {
  // handle incoming link request from client 
  socket.on("sendLinkRequest", async (data, callback) => {
    try {
      console.log("📨 Received sendLinkRequest:", data);

      const { senderId, receiverId } = data.data;
      console.log(senderId, receiverId)
      // Validate input
      if (!senderId || !receiverId) {
        return callback?.({
          success: false,
          message: "Sender ID and Receiver ID are required.",
        });
      }

      // Fetch both users
      const [sender, receiver] = await Promise.all([
        userModel.findById(senderId),
        userModel.findById(receiverId),
      ]);

      if (!sender || !receiver) {
        return callback?.({
          success: false,
          message: "Sender or receiver not found in the system.",
        });
      }

      // Prevent self-linking
      if (senderId === receiverId) {
        return callback?.({
          success: false,
          message: "You cannot send a link request to yourself.",
        });
      }

      // Check if already linked
      if (
        sender.links.includes(receiver._id) &&
        receiver.links.includes(sender._id)
      ) {
        return callback?.({
          success: false,
          message: "You are already linked with this user.",
        });
      }

      // Check if request already sent
      if (sender.sentLinks.includes(receiver._id)) {
        return callback?.({
          success: false,
          message: "You have already sent a link request to this user.",
        });
      }

      // Check if request already received (i.e. sender is in receiver's sentLinks)
      if (receiver.sentLinks.includes(sender._id)) {
        return callback?.({
          success: false,
          message: "This user has already sent you a link request.",
        });
      }

      // Add to both users' pending requests
      sender.sentLinks.push(receiver._id);
      receiver.receivedLinks.push(sender._id);


      await Promise.all([sender.save(), receiver.save()]);

      // ✅ Emit event to receiver if online
      try {
        const receiverSocketId = await redis.get(`socket:${receiverId}`);
        const senderSocketId = await redis.get(`socket:${senderId}`);

        // 🔔 Emit event to receiver with sender info
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("linkRequestReceived", {
            from: {
              id: sender.id,
              username: sender.username,
              profilePicture: sender.profilePicture,
            },
          });
        }

        // ✅ Emit ACK back to sender
        if (senderSocketId) {
          io.to(senderSocketId).emit("linkRequestReceivedAck", {
            success: true,
            message: `Link request sent to ${receiver.username}`,
            to: {
              id: receiver.id,
              username: receiver.username,
              profilePicture: receiver.profilePicture,
            },
          });
        }
      } catch (emitErr) {
        console.warn("⚠️ Could not notify receiver or sender:", emitErr.message);
      }

      // Notify success
      return callback?.({
        success: true,
        message: "Link request sent successfully.",
        senderId,
        receiverId,
      });

      // Optionally emit to receiver client

    } catch (error) {
      console.error("❌ Error in sendLinkRequest:", error);
      return callback?.({
        success: false,
        message: "Internal server error while sending link request.",
      });
    }
  });

  //handle incoming 'link request' withdraw event from client
  socket.on("withdrawLinkRequest", async (data, callback) => {
    console.log("📨 Received withdrawLinkRequest:", data);
    const { senderId, receiverId } = data.data;

    // Validate input
    if (!senderId || !receiverId) {
      return callback?.({
        success: false,
        message: "Sender ID and Receiver ID are required.",
      });
    }

    // Fetch both users
    const [sender, receiver] = await Promise.all([
      userModel.findById(senderId),
      userModel.findById(receiverId),
    ]);

    if (!sender || !receiver) {
      return callback?.({
        success: false,
        message: "Sender or receiver not found in the system.",
      });
    }

    // Remove receiver from sender's sentLinks
    sender.sentLinks = sender.sentLinks.filter(
      (id) => id.toString() !== receiverId
    );

    // Remove sender from receiver's receivedLinks
    receiver.receivedLinks = receiver.receivedLinks.filter(
      (id) => id.toString() !== senderId
    );

    await Promise.all([sender.save(), receiver.save()]);

    try {
      // Get socket IDs from Redis
      const senderSocketId = await redis.get(`socket:${senderId}`);
      const receiverSocketId = await redis.get(`socket:${receiverId}`);

      // Notify sender: withdrawal acknowledgment
      if (senderSocketId) {
        io.to(senderSocketId).emit("linkRequestWithdrawAck", {
          success: true,
          to: {
            id: receiver.id,
            username: receiver.username,
          },
        });
        console.log(`✅ Sent withdraw ACK to sender (${sender.username})`);
      }

      // Notify receiver: the request was withdrawn
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("linkRequestWithdrawn", {
          from: {
            id: sender.id,
            username: sender.username,
          },
        });
        console.log(`📭 Notified receiver (${receiver.username}) of withdrawn request`);
      }
    } catch (emitErr) {
      console.warn("⚠️ Could not notify sender or receiver of withdrawal:", emitErr.message);
    }


    return callback?.({
      success: true,
      message: "Link request withdrawn successfully.",
    });
  });

  //handle incoming reject link request event from client 
  socket.on("rejectLinkRequest", async (data, callback) => {
    console.log("📨 Received rejectLinkRequest:", data);

    const { senderId, receiverId } = data.data;

    // Validate input
    if (!senderId || !receiverId) {
      return callback?.({
        success: false,
        message: "Sender ID and Receiver ID are required.",
      });
    }

    try {
      // Fetch both users
      const [sender, receiver] = await Promise.all([
        userModel.findById(senderId),
        userModel.findById(receiverId),
      ]);

      if (!sender || !receiver) {
        return callback?.({
          success: false,
          message: "Sender or receiver not found in the system.",
        });
      }

      // Remove receiver from sender.sentLinks
      sender.sentLinks = sender.sentLinks.filter(
        (id) => id.toString() !== receiverId
      );

      // Remove sender from receiver.receivedLinks
      receiver.receivedLinks = receiver.receivedLinks.filter(
        (id) => id.toString() !== senderId
      );

      await Promise.all([sender.save(), receiver.save()]);

      // Emit socket updates to both parties
      try {
        const senderSocketId = await redis.get(`socket:${senderId}`);
        const receiverSocketId = await redis.get(`socket:${receiverId}`);

        // 🔔 Notify sender (request got rejected)
        if (senderSocketId) {
          io.to(senderSocketId).emit("linkRequestRejected", {
            by: {
              id: receiver.id,
              username: receiver.username,
              profilePicture: receiver.profilePicture,
            },
          });
        }

        // ✅ Notify receiver (acknowledgement of reject action)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("linkRequestRejectedAck", {
            to: {
              id: sender.id,
              username: sender.username,
              profilePicture: sender.profilePicture,
            },
          });
        }
      } catch (emitErr) {
        console.warn("⚠️ Could not notify both users:", emitErr.message);
      }

      return callback?.({
        success: true,
        message: "Link request rejected successfully.",
      });
    } catch (err) {
      console.error("❌ Error in rejectLinkRequest:", err);
      return callback?.({
        success: false,
        message: "Internal server error while rejecting link request.",
      });
    }
  });

  //handle incoming accept link request event from client
  socket.on("acceptLinkRequest", async (data, callback) => {
    console.log("📨 Received acceptLinkRequest:", data);

    const { senderId, receiverId } = data.data;

    // Validate input
    if (!senderId || !receiverId) {
      return callback?.({
        success: false,
        message: "Sender ID and Receiver ID are required.",
      });
    }

    try {
      // Fetch both users
      const [sender, receiver] = await Promise.all([
        userModel.findById(senderId),
        userModel.findById(receiverId),
      ]);

      if (!sender || !receiver) {
        return callback?.({
          success: false,
          message: "Sender or receiver not found.",
        });
      }

      // Ensure not already linked
      const alreadyLinked =
        sender.links.includes(receiver._id) &&
        receiver.links.includes(sender._id);
      if (alreadyLinked) {
        return callback?.({
          success: false,
          message: "You are already linked.",
        });
      }

      // Add each other to links
      sender.links.push(receiver._id);
      receiver.links.push(sender._id);

      // Remove from pending request arrays
      sender.sentLinks = sender.sentLinks.filter(
        (id) => id.toString() !== receiverId
      );
      receiver.receivedLinks = receiver.receivedLinks.filter(
        (id) => id.toString() !== senderId
      );

      // Save both users
      await Promise.all([sender.save(), receiver.save()]);

      // Emit updates to both users
      try {
        const senderSocketId = await redis.get(`socket:${senderId}`);
        const receiverSocketId = await redis.get(`socket:${receiverId}`);

        // 🔔 Notify sender
        if (senderSocketId) {
          io.to(senderSocketId).emit("linkRequestAccepted", {
            by: {
              id: receiver.id,
              username: receiver.username,
              profilePicture: receiver.profilePicture,
            },
          });
        }

        // ✅ Notify receiver
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("linkRequestAcceptAck", {
            with: {
              id: sender.id,
              username: sender.username,
              profilePicture: sender.profilePicture,
            },
          });
        }
      } catch (emitErr) {
        console.warn("⚠️ Could not notify both users:", emitErr.message);
      }

      return callback?.({
        success: true,
        message: "Link request accepted.",
      });
    } catch (err) {
      console.error("❌ Error in acceptLinkRequest:", err);
      return callback?.({
        success: false,
        message: "Internal server error while accepting request.",
      });
    }
  });

  //handle incoming delete link event from client
  socket.on("deleteLink", async (data, callback) => {
    console.log("📨 Received deleteLink:", data);

    const { linkedUserId, userId } = data.data;

    // Validation
    if (!linkedUserId || !userId) {
      return callback?.({
        success: false,
        message: "Both userId and linkedUserId are required.",
      });
    }

    try {
      const [user, linkedUser] = await Promise.all([
        userModel.findById(userId),
        userModel.findById(linkedUserId),
      ]);

      if (!user || !linkedUser) {
        return callback?.({
          success: false,
          message: "One or both users not found.",
        });
      }

      // Remove from each other's links
      user.links = user.links.filter((id) => id.toString() !== linkedUserId);
      linkedUser.links = linkedUser.links.filter((id) => id.toString() !== userId);

      // Add to user's receivedLinks
      if (!user.receivedLinks.includes(linkedUser._id)) {
        user.receivedLinks.push(linkedUser._id);
      }

      // Add to linkedUser's sentLinks
      if (!linkedUser.sentLinks.includes(user._id)) {
        linkedUser.sentLinks.push(user._id);
      }

      await Promise.all([user.save(), linkedUser.save()]);

      // 🔔 Emit real-time updates to both
      try {
        const userSocketId = await redis.get(`socket:${userId}`);
        const linkedUserSocketId = await redis.get(`socket:${linkedUserId}`);

        // Notify the linked user
        if (linkedUserSocketId) {
          io.to(linkedUserSocketId).emit("linkDeleted", {
            by: {
              id: user.id,
              username: user.username,
              profilePicture: user.profilePicture,
            },
          });
        }

        // Acknowledge to the user who initiated the deletion
        if (userSocketId) {
          io.to(userSocketId).emit("linkDeletedAck", {
            to: {
              id: linkedUser.id,
              username: linkedUser.username,
              profilePicture: linkedUser.profilePicture,
            },
          });
        }
      } catch (emitErr) {
        console.warn("⚠️ Could not notify both users after unlinking:", emitErr.message);
      }

      return callback?.({
        success: true,
        message: "Link successfully deleted.",
      });
    } catch (err) {
      console.error("❌ Error in deleteLink:", err);
      return callback?.({
        success: false,
        message: "Internal server error while deleting link.",
      });
    }
  });



};
