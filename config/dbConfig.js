import mongoose from "mongoose";

const connectDb = async (url) => {
  try {
    await mongoose.connect(url)
    console.log("💾 Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to the database: ", error.message);
    // Retry logic
    setTimeout(() => connectDb(url), 5000);
  }
}
export default connectDb