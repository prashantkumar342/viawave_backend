import express from "express";
import updateUser from "./updateUser.js";
import uploadPost from "./uploadPosts.js"
import notification from "./sendNotification.js"

const router = express.Router();

router.use("/upload", updateUser);
router.use("/upload/post", uploadPost)
router.use("/notify", notification)

export default router