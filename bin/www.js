// /bin/www.js
import express from 'express';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import jwt from 'jsonwebtoken';
import { makeExecutableSchema } from '@graphql-tools/schema';

import indexRouter from '../routes/routes.js';
import { resolvers, typeDefs } from '../graphql/schema.js';
import { uploadSingleFile, uploadMultipleFiles, handleUploadError, deleteFile } from '../middlewares/upload.js';
import { User } from '../models/userModel.js';
import { Logger } from '../utils/logger.js';

const __dirname = path.resolve();
const HTTP_PORT = process.env.PORT || 9095;

// ----------------------
// WebSocket Auth
// ----------------------
const createWebSocketContext = async (ctx) => {
  try {
    const token = ctx.connectionParams?.Authorization || ctx.connectionParams?.authorization || ctx.connectionParams?.token;
    if (!token) return { user: null, authenticated: false };

    const cleanToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return { user: null, authenticated: false };
    return { user, authenticated: true };
  } catch (error) {
    Logger.error('WS auth error:', error.message);
    return { user: null, authenticated: false };
  }
};

// ----------------------
// Start Server
// ----------------------
export default async function startServer() {
  try {
    Logger.info('🚀 Starting server...');

    const app = express();
    app.disable('x-powered-by');

    app.use(cors({ origin: '*', credentials: true }));
    app.use(express.json());
    app.use(cookieParser());

    // Serve static files
    app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

    // GraphQL
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const apolloServer = new ApolloServer({ schema, introspection: true, context: ({ req, res }) => ({ req, res }) });
    await apolloServer.start();
    apolloServer.applyMiddleware({ app, path: '/graphql' });

    // HTTP & WebSocket
    const httpServer = http.createServer(app);
    const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
    useServer({ schema, context: createWebSocketContext }, wsServer);
    Logger.info('✅ WS subscriptions enabled');

    // Health Check
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
    });

    // Routes
    app.use('/', indexRouter);

    // ----------------------
    // File Upload Routes
    // ----------------------
    app.post('/upload/single', uploadSingleFile(), handleUploadError, async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded', statusCode: 400 });

        const filePath = `/uploads/${req.body.folderName || 'default'}/${req.file.filename}`;
        // Delete old profile picture if required
        if (req.body.folderName === 'profiles' && req.body.userId) {
          try {
            const user = await User.findById(req.body.userId);
            if (user?.profilePicture) await deleteFile(user.profilePicture);
          } catch (err) { Logger.warn('Failed to delete previous profile picture:', err); }
        }

        res.status(200).json({
          success: true,
          message: 'File uploaded successfully',
          statusCode: 200,
          data: { filename: req.file.filename, originalName: req.file.originalname, path: filePath, size: req.file.size, mimetype: req.file.mimetype },
        });
      } catch (error) {
        Logger.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed', statusCode: 500 });
      }
    });

    app.post('/upload/multiple', uploadMultipleFiles(), handleUploadError, async (req, res) => {
      try {
        if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No files uploaded', statusCode: 400 });

        const uploadedFiles = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/${req.body.folderName || 'default'}/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype,
        }));

        res.status(200).json({ success: true, message: 'Files uploaded successfully', statusCode: 200, data: uploadedFiles });
      } catch (error) {
        Logger.error('Multiple upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed', statusCode: 500 });
      }
    });

    // Start HTTP Server
    httpServer.listen(HTTP_PORT, () => {
      Logger.success(`🌐 HTTP: http://localhost:${HTTP_PORT}`);
      Logger.success(`🚀 GraphQL: http://localhost:${HTTP_PORT}${apolloServer.graphqlPath}`);
      Logger.success(`📡 Subscriptions: ws://localhost:${HTTP_PORT}${apolloServer.graphqlPath}`);
    });
  } catch (error) {
    Logger.error('❌ Server start failed:', error);
    process.exit(1);
  }
}
