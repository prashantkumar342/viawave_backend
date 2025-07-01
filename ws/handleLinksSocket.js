import { User as userModel } from "../models/userModel.js";

export const handleLinksSocket = (socket) => {
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
};
