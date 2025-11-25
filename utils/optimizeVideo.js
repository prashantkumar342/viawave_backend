import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { Logger } from './logger.js';

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Optimizes video buffer by moving moov atom to the front (faststart).
 * Uses temporary files to ensure FFmpeg stability.
 * Returns a Promise that resolves to the optimized Buffer.
 */
export const optimizeVideoBuffer = async (
  inputBuffer,
  originalName = 'video.mp4'
) => {
  // 1. Create unique temp file paths
  const tempDir = os.tmpdir();
  const uniqueId = Date.now() + Math.random().toString(36).slice(2);
  const ext = path.extname(originalName) || '.mp4';

  const inputPath = path.join(tempDir, `raw-${uniqueId}${ext}`);
  const outputPath = path.join(tempDir, `opt-${uniqueId}.mp4`);

  try {
    // 2. Write the raw buffer to disk
    await fs.promises.writeFile(inputPath, inputBuffer);

    // 3. Run FFmpeg on the file
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions('-movflags +faststart')
        .save(outputPath) // Save to disk instead of stream
        .on('end', resolve)
        .on('error', (err) => {
          Logger.error('FFmpeg file optimization error:', err);
          reject(err);
        });
    });

    // 4. Read the optimized file back into a buffer
    const optimizedBuffer = await fs.promises.readFile(outputPath);
    return optimizedBuffer;
  } catch (error) {
    console.log('VideoOptmizer error:', error);
    throw error;
  } finally {
    // 5. CLEANUP: Delete temp files (Crucial!)
    try {
      if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
      if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
    } catch (cleanupErr) {
      Logger.error('Error cleaning up temp video files:', cleanupErr);
    }
  }
};
