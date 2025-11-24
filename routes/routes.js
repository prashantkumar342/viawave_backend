import express from 'express';

import creatPost from './createPost.js';
import postsRouter from './posts.js';
import notification from './sendNotification.js';
import updateUser from './updateUser.js';
import uploadPost from './uploadPosts.js';

const router = express.Router();

router.use('/upload', updateUser);
router.use('/upload/post', uploadPost);
router.use('/notify', notification);
router.use('/post', creatPost);
router.use('/posts', postsRouter);

export default router;
