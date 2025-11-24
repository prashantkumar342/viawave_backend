// src/services/posts.service.js
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { s3Client } from '../config/storageClient.js';
import { getPresignedUrl } from '../utils/presignedUrl.js';

ffmpeg.setFfmpegPath(ffmpegPath);

const BUCKET = process.env.S3_BUCKET;
const THUMB_PREFIX = process.env.THUMB_PREFIX || 'thumbnails/';

export const headObject = async (key) => {
  const cmd = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
  return s3Client.send(cmd);
};

export const getObjectStream = async (key, range) => {
  // range: optional "bytes=start-end"
  const params = { Bucket: BUCKET, Key: key };
  if (range) params.Range = range;
  const cmd = new GetObjectCommand(params);
  return s3Client.send(cmd); // returns response with Body as stream
};

export const createPresigned = async (key, expiresInSeconds = 3600) => {
  // key expected relative (like "posts/xxx.jpg" or "viawave/..." depending on your keys)
  return getPresignedUrl(key, expiresInSeconds);
};

/**
 * Generate or fetch thumbnail for given video key.
 * This implementation uses a temporary file on disk for ffmpeg processing.
 * In production, consider using a background worker queue.
 *
 * Returns presigned URL for thumbnail.
 */
export const getOrCreateThumbnail = async (
  videoKey,
  expiresInSeconds = 3600
) => {
  // form thumb key
  // if videoKey is "posts/abc.mp4" => thumbnail "thumbnails/posts/abc.mp4.jpg" (or choose naming you prefer)
  const thumbKey = `${THUMB_PREFIX}${videoKey}.jpg`.replace(/\/+/g, '/');

  // 1) check if thumbnail already exists
  try {
    // const head = await headObject(thumbKey);
    // exists -> return presigned url
    return createPresigned(thumbKey, expiresInSeconds);
  } catch (err) {
    // not found -> continue to generate
    console.log('Thumbnail not found:', err);
  }

  // 2) download a small portion of the video (or whole if small) to a temp file
  const tempDir = os.tmpdir();
  const videoTmpPath = path.join(
    tempDir,
    `video-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`
  );
  const thumbTmpPath = path.join(
    tempDir,
    `thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  );

  // Download whole file streaming to disk (for large videos you may want to stream first N seconds only)
  const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: videoKey });
  const resp = await s3Client.send(getCmd);
  const bodyStream = resp.Body;
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(videoTmpPath);
    bodyStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    bodyStream.on('error', reject);
  });

  // 3) use ffmpeg to extract a frame (at 1 second) and save to thumbTmpPath
  await new Promise((resolve, reject) => {
    ffmpeg(videoTmpPath)
      .screenshots({
        timestamps: ['00:00:01.000', '00:00:02.000'],
        filename: path.basename(thumbTmpPath),
        folder: path.dirname(thumbTmpPath),
        size: '480x?',
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // 4) upload thumbnail to bucket
  const thumbBuffer = await fs.promises.readFile(thumbTmpPath);
  const putCmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: thumbKey,
    Body: thumbBuffer,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=86400',
  });

  await s3Client.send(putCmd);

  // cleanup temp files (best-effort)
  try {
    fs.unlinkSync(videoTmpPath);
    fs.unlinkSync(thumbTmpPath);
  } catch (e) {
    // ignore
    console.log('Error cleaning up temp files:', e);
  }

  // 5) return presigned url
  return createPresigned(thumbKey, expiresInSeconds);
};

/**
 * Convenience helper: validate key shape and optionally normalize leading slash
 */
export const normalizeKey = (key) => {
  if (!key || typeof key !== 'string') return key;
  if (key.startsWith('/')) return key.slice(1);
  return key;
};
