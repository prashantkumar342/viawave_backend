import express from "express";
import updateUser from "./updateUser.js";
import uploadPost from "./uploadPosts.js"
import notification from "./sendNotification.js"
import creatPost from "./createPost.js"

const router = express.Router();

router.use("/upload", updateUser);
router.use("/upload/post", uploadPost)
router.use("/notify", notification)
router.use("/post", creatPost)

export default router