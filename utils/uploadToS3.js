// utils/uploadToS3.js
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { s3Client } from '../config/storageClient.js';
import { Logger } from '../utils/logger.js';

const BUCKET = process.env.S3_BUCKET || process.env.STORAGE_BUCKET;

export const uploadFile = async (
  fileBuffer,
  originalName,
  mimeType,
  folder = ''
) => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('uploadFile expects a Buffer as first argument');
  }
  // normalize folder (no leading/trailing slashes)
  const folderClean = String(folder || '').replace(/^\/+|\/+$/g, '');
  const ext = path.extname(originalName || '') || '';
  const uniqueName = `${uuidv4()}${ext}`;
  const key = folderClean ? `${folderClean}/${uniqueName}` : uniqueName;

  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType || 'application/octet-stream',
    CacheControl:
      mimeType && mimeType.startsWith('image/')
        ? 'public, max-age=86400'
        : 'private, max-age=3600',
  });

  try {
    await s3Client.send(cmd);

    // OPTIONAL: verify upload by HEADing the object (safer)
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    } catch (headErr) {
      Logger.error('uploadFile: HEAD check failed for key', {
        key,
        err: headErr,
      });
      // fall through — you can choose to throw here if you want strict verification
    }

    // RETURN the KEY (not a full URL). Clients / resolvers should presign this key.
    return `${BUCKET}/${key}`;
  } catch (err) {
    Logger.error('uploadFile failed', { key, err });
    throw err;
  }
};
