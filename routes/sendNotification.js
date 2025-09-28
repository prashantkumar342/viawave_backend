import express from "express";
import  auth  from "../middlewares/auth.js";
import { pushNotifications } from "../services/pushNotifications.service.js";
import { Logger } from "../utils/logger.js";

const router = express.Router();
const { sendToUser } = pushNotifications();

/**
 * POST /notifications/test
 * Trigger a test notification for the logged-in user
 */
router.post("/test-nofify", auth, async (req, res) => {
  try {
    const { title, body, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Title and body are required for notification",
      });
    }

    await sendToUser(req.user._id, title, body, data || {});

    Logger.info(`✅ Test notification sent to user ${req.user._id}`);
    res.json({
      success: true,
      message: "Notification sent successfully",
    });
  } catch (err) {
    Logger.error("❌ Error sending test notification:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: err.message,
    });
  }
});

export default router;
