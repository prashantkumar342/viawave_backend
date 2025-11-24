// src/controllers/posts.controller.js
import asyncHandler from 'express-async-handler';
// adapt path to your requireAuth
import { pipeline } from 'stream';
import { promisify } from 'util';

import {
  createPresigned,
  getObjectStream,
  getOrCreateThumbnail,
  headObject,
  normalizeKey,
} from '../services/posts.service.js';

const pipe = promisify(pipeline);

/**
 * Stream an S3/MinIO object with Range support.
 * Route: GET /posts/stream/:key
 */
export const streamObjectHandler = asyncHandler(async (req, res) => {
  // optional: enforce auth
  try {
    // If you want protected streaming, uncomment:
    // await requireAuth(req);

    const rawKey = decodeURIComponent(req.params.key);
    const key = normalizeKey(rawKey);

    // head to get content length and type
    const head = await headObject(key);
    const fileSize = Number(head.ContentLength);
    const contentType = head.ContentType || 'application/octet-stream';

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      const range = `bytes=${start}-${end}`;
      const s3Resp = await getObjectStream(key, range);

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });

      await pipe(s3Resp.Body, res);
    } else {
      // full file
      const s3Resp = await getObjectStream(key);
      res.writeHead(200, {
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      await pipe(s3Resp.Body, res);
    }
  } catch (err) {
    console.error('streamObjectHandler error:', err);
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.status(500).json({ error: 'Failed to stream object' });
    }
  }
});

/**
 * Return a presigned URL to GET an object (image or other static files).
 * Route: GET /posts/presign/:key
 */
export const presignHandler = asyncHandler(async (req, res) => {
  // optional auth: await requireAuth(req);
  const rawKey = decodeURIComponent(req.params.key);
  const key = normalizeKey(rawKey);

  try {
    const url = await createPresigned(key, 60 * 10); // 10 minutes
    res.json({ url, expiresIn: 60 * 10 });
  } catch (err) {
    console.error('presignHandler error', err);
    res.status(500).json({ error: 'Failed to create presigned url' });
  }
});

/**
 * Get or create thumbnail for a video. Returns a presigned URL to thumbnail.
 * Route: GET /posts/thumbnail/:key
 */
export const thumbnailHandler = asyncHandler(async (req, res) => {
  // optional auth: await requireAuth(req);
  const rawKey = decodeURIComponent(req.params.key);
  const key = normalizeKey(rawKey);

  try {
    const thumbUrl = await getOrCreateThumbnail(key, 60 * 60);
    res.json({ url: thumbUrl });
  } catch (err) {
    console.error('thumbnailHandler error', err);
    res.status(500).json({ error: 'Failed to generate/get thumbnail' });
  }
});
