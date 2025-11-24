// services/posts.service.js (or utils/generateThumbnail.js)
import ffmpegStatic from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { uploadFile } from '../utils/uploadToS3.js';

// adapt path if needed

ffmpeg.setFfmpegPath(ffmpegStatic);

const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

/**
 * Generate thumbnail from a Buffer using disk (robust), upload it and return the uploaded key.
 * @param {Buffer} videoBuffer
 * @param {Object} opts
 * @param {string} opts.thumbFolder - remote prefix for thumbnail upload
 * @param {string} opts.origKey - original object key used for naming
 * @param {string} opts.time - timemark like '00:00:01'
 * @param {string} opts.size - ffmpeg size '480x?'
 */
export async function generateAndUploadThumbnail(
  videoBuffer,
  {
    thumbFolder = 'thumbnails',
    origKey = '',
    time = '00:00:01',
    size = '480x?',
  } = {}
) {
  const tmpDir = os.tmpdir();
  const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = path.extname(origKey) || '.mp4';
  const videoTmpPath = path.join(tmpDir, `video-${uniq}${ext}`);
  const thumbTmpPath = path.join(tmpDir, `thumb-${uniq}.jpg`);

  try {
    // write buffer to temp video file
    await writeFile(videoTmpPath, videoBuffer);

    // run ffmpeg screenshots -> writes thumbTmpPath
    await new Promise((resolve, reject) => {
      let stderr = '';
      let stdout = '';

      ffmpeg(videoTmpPath)
        .screenshots({
          timestamps: [time],
          filename: path.basename(thumbTmpPath),
          folder: path.dirname(thumbTmpPath),
          size,
        })
        .on('error', (err, sdout, sderr) => {
          // collect ffmpeg output for diagnostics
          const e = new Error('ffmpeg error: ' + (err?.message || err));
          e.ffmpeg = { stdout: sdout || stdout, stderr: sderr || stderr };
          reject(e);
        })
        .on('end', () => resolve())
        .on('stderr', (line) => {
          stderr += line + '\n';
        })
        .on('stdout', (line) => {
          stdout += line + '\n';
        });
    });

    // tiny wait/retry loop to make sure the file is visible to fs (Windows occasional delay)
    const MAX_RETRIES = 6;
    const RETRY_DELAY_MS = 150;
    let found = false;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const s = await stat(thumbTmpPath);
        if (s && s.size > 10) {
          // sanity size > 10 bytes
          found = true;
          break;
        }
      } catch (e) {
        // ignore and retry
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }

    if (!found) {
      throw new Error(`Thumbnail file not created: ${thumbTmpPath}`);
    }

    // read thumbnail buffer
    const thumbBuffer = await fs.promises.readFile(thumbTmpPath);

    // build upload name safely
    const base = path.basename(origKey || `thumb-${uniq}`, path.extname(origKey || ''));
    const safeName = `${base}.jpg`;

    // upload using your upload util (ensure it accepts Buffer)
    const uploadedKey = await uploadFile(
      thumbBuffer,
      safeName,
      'image/jpeg',
      thumbFolder
    );

    // cleanup
    try {
      await unlink(videoTmpPath);
    } catch (e) {
      /* ignore */
    }
    try {
      await unlink(thumbTmpPath);
    } catch (e) {
      /* ignore */
    }

    return uploadedKey;
  } catch (err) {
    // cleanup then rethrow with context
    try {
      await unlink(videoTmpPath);
    } catch (e) {}
    try {
      await unlink(thumbTmpPath);
    } catch (e) {}
    const err2 = new Error(
      'generateAndUploadThumbnail failed: ' + (err.message || err)
    );
    err2.original = err;
    throw err2;
  }
}
