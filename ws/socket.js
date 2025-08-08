// socketIoServer.js
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

// Import Redis client
import { Logger } from '../utils/logger.js';
import { redis } from '../utils/redisClient.js';
import handleSocketsIndex from './handleSocketsIndex.js';

export const socketIoServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  Logger.success('📶 Socket.io signaling started');

  io.on('connection', async (socket) => {
    const token = socket.handshake.auth?.token;

    try {
      if (!token) throw new Error('No token provided');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      console.log('🆕 New socket connected:', socket.id);
      console.log('🔍 Authenticated user:', userId);

      // Save to Redis
      await redis.set(`socket:${userId}`, socket.id);
      await redis.set(`user:${socket.id}`, userId);

      // Attach to socket instance for later cleanup
      socket.userId = userId;

      // Pass to custom handlers
      handleSocketsIndex(socket, io);

      socket.on('disconnect', async () => {
        console.log('❌ Disconnected:', socket.id);
        // Clean Redis
        await redis.del(`socket:${socket.userId}`);
        await redis.del(`user:${socket.id}`);
      });
    } catch (err) {
      console.error('❌ Socket auth error:', err.message);
      socket.disconnect();
    }
  });
};
