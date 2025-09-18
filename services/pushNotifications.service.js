import { messaging } from "../config/firebase.js";
import { User } from "../models/userModel.js";

/**
 * Send notifications using Firebase Cloud Messaging
 */
export const pushNotifications = () => {
  /**
   * Send to ALL users in DB
   */
  const sendToAllUsers = async (title, body, data = {}) => {
    try {
      const users = await User.find({ fcmToken: { $exists: true, $ne: null } });
      const tokens = users.map(u => u.fcmToken);

      if (tokens.length === 0) {
        console.warn("⚠️ No FCM tokens found for users");
        return;
      }

      const message = {
        notification: { title, body },
        data,
        tokens, // send to multiple
      };

      const response = await messaging.sendEachForMulticast(message);
      console.log("✅ Notifications sent to all users:", response.successCount);
    } catch (err) {
      console.error("❌ Error sending notifications to all users:", err);
    }
  };

  /**
   * Send to a SPECIFIC user (by ID)
   */
  const sendToUser = async (userId, title, body, data = {}) => {
    try {
      const user = await User.findById(userId);
      if (!user?.fcmToken) {
        console.warn(`⚠️ No FCM token found for user ${userId}`);
        return;
      }

      const message = {
        notification: { title, body },
        data,
        token: user.fcmToken,
        android: {
          notification: {
            icon: "ic_notification"
          },
        },
      };

      const response = await messaging.send(message);
      console.log(`✅ Notification sent to user ${userId}:`, response);
    } catch (err) {
      console.error(`❌ Error sending notification to user ${userId}:`, err);
    }
  };

  /**
   * Send to SELECTED users or raw tokens
   */
  const sendToUsers = async (tokensOrUserIds, title, body, data = {}) => {
    try {
      let tokens = [];

      // If provided array is IDs, fetch tokens
      if (typeof tokensOrUserIds[0] === "string" && tokensOrUserIds[0].length === 24) {
        const users = await User.find({
          _id: { $in: tokensOrUserIds },
          fcmToken: { $exists: true, $ne: null },
        });
        tokens = users.map(u => u.fcmToken);
      } else {
        // Assume array is already tokens
        tokens = tokensOrUserIds;
      }

      if (tokens.length === 0) {
        console.warn("⚠️ No FCM tokens found for sendToUsers");
        return;
      }

      const message = {
        notification: { title, body },
        data,
        tokens,
      };

      const response = await messaging.sendEachForMulticast(message);
      console.log("✅ Notifications sent to selected users:", response.successCount);
    } catch (err) {
      console.error("❌ Error sending to selected users:", err);
    }
  };

  return { sendToAllUsers, sendToUser, sendToUsers };
};
