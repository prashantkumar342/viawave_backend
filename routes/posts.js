import express from 'express';

import { streamObjectHandler } from '../controllers/posts.controller.js';

const router = express.Router();

router.get('/stream/:key', streamObjectHandler);

export default router;
