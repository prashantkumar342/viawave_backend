// storageClient.js
import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT, // MinIO or S3
  region: process.env.STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: true, // required for MinIO, works fine for S3 too
});

export { s3Client };
