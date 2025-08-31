import fs from "fs";
import path from "path";

export async function saveFile(file, folder = "uploads") {
  const { createReadStream, filename, mimetype, encoding } = await file;

  // Ensure folder exists
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  // Generate unique filename
  const uniqueName = Date.now() + "-" + filename;
  const filePath = path.join(folder, uniqueName);

  // Save file stream
  const stream = createReadStream();
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    stream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  // Return file info
  return {
    filename: uniqueName,
    mimetype,
    encoding,
    url: `http://localhost:4000/${folder}/${uniqueName}`,
  };
} 