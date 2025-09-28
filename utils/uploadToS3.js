import { PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { s3Client } from "../config/storageClient.js";

/**
 * Uploads a file to S3/MinIO with a unique name.
 * @param {Buffer} fileBuffer - The file data.
 * @param {string} originalName - Original file name (used to extract extension).
 * @param {string} mimeType - MIME type (e.g., image/jpeg).
 * @param {string} folder - The folder inside the bucket.
 * @returns {string} - Public URL of the uploaded file.
 */
export const uploadFile = async (fileBuffer, originalName, mimeType, folder) => {
  // Get extension from original file
  const ext = path.extname(originalName) || "";

  // Generate unique filename
  const uniqueName = `${uuidv4()}${ext}`;

  // Key = folder/uniqueName
  const key = `${folder}/${uniqueName}`;

  // Upload to bucket
  const command = new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return `${process.env.STORAGE_BUCKET}/${key}`;
};
