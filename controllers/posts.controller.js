// src/controllers/posts.controller.js
import asyncHandler from 'express-async-handler';
// adapt path to your requireAuth
import { pipeline } from 'node:stream/promises';

// import { promisify } from 'util';

import {
  getObjectStream,
  headObject,
  normalizeKey,
} from '../services/posts.service.js';

// import { requireAuth } from '../utils/requireAuth.js';

// const pipe = promisify(pipeline);

const MAX_CHUNK_SIZE = 1024 * 1024; // 1MB

export const streamObjectHandler = asyncHandler(async (req, res) => {
  try {
    // optional: enforce auth
    // await requireAuth(req);

    const rawKey = decodeURIComponent(req.params.key);
    const key = normalizeKey(rawKey);

    // 2. Get Metadata
    // We need the total file size to calculate ranges correctly.
    const head = await headObject(key);
    const fileSize = Number(head.ContentLength);
    const contentType = head.ContentType || 'application/octet-stream';

    const rangeHeader = req.headers.range;

    // 3. Handle Range Requests (Standard for Video Streaming)
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);

      // Calculate End
      // If the browser didn't ask for a specific end, OR if the requested end is huge,
      // we enforce our MAX_CHUNK_SIZE. This is key for "smooth" performance.
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Optimization: Cap the chunk size
      if (end - start >= MAX_CHUNK_SIZE) {
        end = start + MAX_CHUNK_SIZE - 1;
      }

      // Safety check
      if (start >= fileSize) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      const range = `bytes=${start}-${end}`;
      const s3Resp = await getObjectStream(key, range);

      // 4. Write Partial Content Headers
      // write headers
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });

      // ensure headers are sent immediately (helps client start playback)
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      // 5. Use Pipeline for Robust Streaming
      // 's3Resp.Body' is the readable stream from AWS/MinIO
      // 'res' is the writable stream (Express response)
      // Pipeline automatically handles destroying streams if the browser disconnects (stops watching).
      await pipeline(s3Resp.Body, res);
    } else {
      // 6. Fallback: No Range Header (Download full file)
      // It is rare for a video player to not send a range header, but we handle it.
      const s3Resp = await getObjectStream(key);

      res.writeHead(200, {
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      });

      await pipeline(s3Resp.Body, res);
    }
  } catch (err) {
    // Avoid logging 'Aborted' errors which happen when users skip/scrub video
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error('streamObjectHandler error:', err);
    }

    if (!res.headersSent) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.status(500).json({ error: 'Failed to stream object' });
      }
    }
  }
});
