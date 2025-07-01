import { Server } from "socket.io";
import handleSocketsIndex from "./handleSocketsIndex.js";

export const socketIoServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  console.log("📶 Socket.io signaling started");

  io.on("connection", (socket) => {
    console.log("🆕 New socket connected:", socket.id);


    //handleSocketsIndex
    handleSocketsIndex(socket, io);

    // Optional: handle disconnect
    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
    });
  });
};
