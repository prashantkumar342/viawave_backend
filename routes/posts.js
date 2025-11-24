import express from 'express';

import {
  presignHandler,
  streamObjectHandler,
  thumbnailHandler,
} from '../controllers/posts.controller.js';

const router = express.Router();

router.get('/stream/:key', streamObjectHandler);
router.get('/presign/:key', presignHandler);
router.get('/thumbnail/:key', thumbnailHandler);

export default router;
