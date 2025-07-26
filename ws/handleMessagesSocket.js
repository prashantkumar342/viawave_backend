// handleMessageSocket.js
import { Conversation } from "../models/conversationModel.js";
import { Message } from "../models/messageModel.js";
import { redis } from "../utils/redisClient.js";

export const handleMessageSocket = (socket, io) => {
  socket.on("newMessage", async (data, callback) => {
    try {
      console.log("📨 newMessage received:", data);

      const { conversationId, senderId, text, attachments = [] } = data;

      if (!conversationId || !senderId || !text) {
        return callback?.({
          success: false,
          message: "conversationId, senderId, and text are required.",
        });
      }

      // ✅ Save the message to DB
      const newMessage = await Message.create({
        conversation: conversationId,
        sender: senderId,
        text: text,
        attachments: attachments,
        seenBy: [senderId], // sender has seen it by default
      });

      // ✅ Populate sender
      const populatedMessage = await newMessage.populate("sender", "id username profilePicture isVerified");

      // ✅ Update lastMessage in conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: populatedMessage._id,
      });

      // ✅ Emit message back to sender for ACK
      socket.emit("newMessageAck", {
        conversationId,
        message: populatedMessage,
      });

      // ✅ Get all participants
      const conversation = await Conversation.findById(conversationId).populate("participants", "id");

      if (!conversation) {
        return callback?.({
          success: false,
          message: "Conversation not found.",
        });
      }

      // ✅ Get all participants except sender
      const receivers = conversation.participants.filter(
        (user) => user._id.toString() !== senderId
      );

      // ✅ Send real-time message to all receivers
      for (const receiver of receivers) {
        try {
          // Get socket ID from Redis
          const userSocketId = await redis.get(`socket:${receiver._id.toString()}`);

          if (userSocketId) {
            // Send to specific socket
            io.to(userSocketId).emit("newMessageReceived", {
              conversationId,
              message: populatedMessage,
            });
            console.log(`📤 Message sent to user ${receiver._id.toString()} via socket ${userSocketId}`);
          } else {
            // Fallback: try to send to user ID (in case socket is stored differently)
            io.to(receiver._id.toString()).emit("newMessageReceived", {
              conversationId,
              message: populatedMessage,
            });
            console.log(`📤 Message sent to user ${receiver._id.toString()} via user ID`);
          }
        } catch (redisError) {
          console.error(`❌ Failed to get socket ID for user ${receiver._id.toString()}:`, redisError);
          // Fallback: try to send to user ID
          io.to(receiver._id.toString()).emit("newMessageReceived", {
            conversationId,
            message: populatedMessage,
          });
        }
      }

      // ✅ Callback success
      callback?.({
        success: true,
        message: "Message delivered.",
        messageId: populatedMessage._id,
      });

    } catch (error) {
      console.error("❌ Failed to process newMessage:", error.message);
      callback?.({
        success: false,
        message: "500: Something went wrong while sending the message.",
        error: error.message,
      });
    }
  });

  // ✅ Handle message read status
  socket.on("markMessageAsRead", async (data, callback) => {
    try {
      const { messageId, userId } = data;

      if (!messageId || !userId) {
        return callback?.({
          success: false,
          message: "messageId and userId are required.",
        });
      }

      // Update message seenBy array
      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { seenBy: userId } },
        { new: true }
      ).populate("sender", "id username profilePicture isVerified");

      if (!message) {
        return callback?.({
          success: false,
          message: "Message not found.",
        });
      }

      // Get conversation to find all participants
      const conversation = await Conversation.findById(message.conversation).populate("participants", "id");

      // Emit read receipt to all participants except the one who marked it as read
      const otherParticipants = conversation.participants.filter(
        (user) => user._id.toString() !== userId
      );

      for (const participant of otherParticipants) {
        try {
          const userSocketId = await redis.get(`socket:${participant._id.toString()}`);

          if (userSocketId) {
            io.to(userSocketId).emit("messageRead", {
              messageId,
              userId,
              conversationId: message.conversation,
            });
          } else {
            io.to(participant._id.toString()).emit("messageRead", {
              messageId,
              userId,
              conversationId: message.conversation,
            });
          }
        } catch (redisError) {
          console.error(`❌ Failed to get socket ID for user ${participant._id.toString()}:`, redisError);
          io.to(participant._id.toString()).emit("messageRead", {
            messageId,
            userId,
            conversationId: message.conversation,
          });
        }
      }

      callback?.({
        success: true,
        message: "Message marked as read.",
      });

    } catch (error) {
      console.error("❌ Failed to mark message as read:", error.message);
      callback?.({
        success: false,
        message: "Failed to mark message as read.",
        error: error.message,
      });
    }
  });

  // ✅ Handle typing indicators
  socket.on("typing", async (data) => {
    try {
      const { conversationId, userId, isTyping } = data;

      if (!conversationId || !userId) {
        return;
      }

      // Get conversation participants
      const conversation = await Conversation.findById(conversationId).populate("participants", "id");

      if (!conversation) {
        return;
      }

      // Send typing indicator to all participants except sender
      const otherParticipants = conversation.participants.filter(
        (user) => user._id.toString() !== userId
      );

      for (const participant of otherParticipants) {
        try {
          const userSocketId = await redis.get(`socket:${participant._id.toString()}`);

          if (userSocketId) {
            io.to(userSocketId).emit("userTyping", {
              conversationId,
              userId,
              isTyping,
            });
          } else {
            io.to(participant._id.toString()).emit("userTyping", {
              conversationId,
              userId,
              isTyping,
            });
          }
        } catch (redisError) {
          console.error(`❌ Failed to get socket ID for user ${participant._id.toString()}:`, redisError);
          io.to(participant._id.toString()).emit("userTyping", {
            conversationId,
            userId,
            isTyping,
          });
        }
      }

    } catch (error) {
      console.error("❌ Failed to handle typing indicator:", error.message);
    }
  });
};