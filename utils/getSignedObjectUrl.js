import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./storageClient.js"; // your configured S3/MinIO client

/**
 * Generates a pre-signed URL for accessing an object.
 * @param {string} key - The object key in the bucket (e.g., "posts/filename.png")
 * @param {number} expiresIn - Time in seconds before URL expires (default 1 hour)
 * @returns {string} - Pre-signed URL
 */
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

export const getSignedObjectUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: key,
    });

    const url = await awsGetSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
};
