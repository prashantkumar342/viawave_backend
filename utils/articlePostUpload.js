import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../config/s3Client.js";

// Helper function to convert stream to buffer and get content length
const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;

    stream.on('data', (chunk) => {
      chunks.push(chunk);
      totalLength += chunk.length;
    });

    stream.on('end', () => {
      resolve({ buffer: Buffer.concat(chunks), length: totalLength });
    });

    stream.on('error', reject);
  });
};

/**
 * Uploads an article cover image to MinIO/S3.
 * @param {Object} file - The GraphQL Upload object.
 * @param {string} username - Used for naming the file.
 * @returns {Promise<string>} - Public URL of the uploaded file.
 */
export const articlePostsUpload = async (file, username) => {
  try {
    const { createReadStream, filename, mimetype } = await file;

    // Convert stream to buffer to get content length
    const stream = createReadStream();
    const { buffer, length } = await streamToBuffer(stream);

    // Unique key for the file
    const key = `posts/articles/${username}-${Date.now()}-${filename}`;

    const uploadParams = {
      Bucket: process.env.S3_BUCKET || "viawave",
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ContentLength: length,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    // Public URL
    return `${process.env.S3_PUBLIC_URL}/${key}`;
  } catch (error) {
    console.error("Article upload error:", error);
    throw new Error("Failed to upload article image");
  }
};
