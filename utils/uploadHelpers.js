import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import fetch from "node-fetch"; // Needed for http URIs from RN
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

export const uploadToS3 = async (file, folder = "uploads") => {
  try {
    const resolvedFile = await Promise.resolve(file);

    let body, filename, mimetype, contentLength;

    if (resolvedFile && typeof resolvedFile === "object") {
      filename = resolvedFile.filename || resolvedFile.name || `file-${Date.now()}`;
      mimetype = resolvedFile.mimetype || resolvedFile.type || "application/octet-stream";

      if (resolvedFile.createReadStream) {
        // GraphQL Upload - convert stream to buffer to get content length
        const stream = resolvedFile.createReadStream();
        const { buffer, length } = await streamToBuffer(stream);
        body = buffer;
        contentLength = length;
      } else if (resolvedFile.buffer) {
        // Buffer - we know the length
        body = resolvedFile.buffer;
        contentLength = resolvedFile.buffer.length;
      } else if (resolvedFile.uri) {
        // React Native file URI
        if (resolvedFile.uri.startsWith("file://")) {
          const path = resolvedFile.uri.replace("file://", "");
          const stats = fs.statSync(path);
          contentLength = stats.size;
          body = fs.createReadStream(path);
        } else if (resolvedFile.uri.startsWith("http")) {
          // Remote URL, fetch buffer
          const res = await fetch(resolvedFile.uri);
          const buffer = await res.buffer();
          body = buffer;
          contentLength = buffer.length;
        } else {
          throw new Error("Unsupported file URI format");
        }
      }
    }

    if (!body) throw new Error("Invalid file object - no readable content found");

    const key = `${folder}/${Date.now()}-${filename}`;

    const uploadParams = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimetype,
      ContentLength: contentLength,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    return `${process.env.S3_PUBLIC_URL}/${key}`;
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};
