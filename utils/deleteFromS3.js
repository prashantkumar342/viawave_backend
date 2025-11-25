import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import { s3Client } from '../config/storageClient.js';
import { Logger } from './logger.js';

export const deleteFromS3 = async (fullKey) => {
  if (!fullKey) return;

  try {
    // Your uploadFile returns "BUCKET_NAME/folder/filename.ext"
    // We need to split this to get the Bucket and the Key separately
    const firstSlashIndex = fullKey.indexOf('/');

    if (firstSlashIndex === -1) {
      Logger.error(`Invalid key format for deletion: ${fullKey}`);
      return;
    }

    const bucket = fullKey.substring(0, firstSlashIndex);
    const key = fullKey.substring(firstSlashIndex + 1);

    const cmd = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(cmd);
    Logger.info(`Rollback: Successfully deleted ${key}`);
  } catch (error) {
    // We log this but don't throw, because we want to try deleting other files too
    Logger.error(`Rollback failed for ${fullKey}:`, error);
  }
};

export const cleanupUploadedFiles = async (keysArray) => {
  if (!keysArray || keysArray.length === 0) return;

  Logger.info(`Starting rollback for ${keysArray.length} files...`);

  // specific logic: use Promise.allSettled so one failure doesn't stop others
  await Promise.allSettled(keysArray.map((key) => deleteFromS3(key)));
};
