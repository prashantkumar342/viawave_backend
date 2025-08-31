import express from "express";
import updateUser from "./updateUser.js";
import uploadPost from "./uploadPosts.js"

const router = express.Router();

router.use("/upload", updateUser);
router.use("/upload/post", uploadPost)

export default router