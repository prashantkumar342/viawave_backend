import { Server } from "socket.io";

export const socketIoServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });
  console.log('📶 Socket.io signaling started')
  io.on("conntection", async (socket) => {
    console.log(socket.id);
  });
};
