// ----------------------
// Core Imports
// ----------------------
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { useServer } from 'graphql-ws/use/ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import path from 'path';
import { WebSocketServer } from 'ws';

import connectDb from './config/dbConfig.js';
import { resolvers, typeDefs } from './graphql/schema.js';
import { User } from './models/userModel.js';
import { Logger } from './utils/logger.js';
import { socketIoServer } from './ws/socket.js';

// ----------------------
// Load Env
// ----------------------
dotenv.config({ path: './.env' });

// ----------------------
// Error Handlers
// ----------------------
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  Logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// ----------------------
// Env Vars
// ----------------------
const __dirname = path.resolve();
const HTTP_PORT = process.env.PORT || 9095;

// ----------------------
// WebSocket Auth
// ----------------------
const createWebSocketContext = async (ctx) => {
  try {
    const token =
      ctx.connectionParams?.Authorization ||
      ctx.connectionParams?.authorization ||
      ctx.connectionParams?.token;

    if (!token) {
      Logger.warn('WS connection without token');
      return { user: null, authenticated: false };
    }

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
async function startServer() {
  try {
    Logger.info('🚀 Starting server...');
    await connectDb(process.env.DATABASE_URL);

    const app = express();
    app.disable('x-powered-by');

    app.use(
      cors({
        origin: '*', // TODO: Restrict in production
        credentials: true,
      })
    );
    app.use(express.json());
    app.use(cookieParser());

    // GraphQL Schema
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    // Apollo Server
    const apolloServer = new ApolloServer({
      schema,
      introspection: true,
      context: ({ req, res }) => ({ req, res }),
    });

    await apolloServer.start();
    apolloServer.applyMiddleware({ app, path: '/graphql' });

    // HTTP Server
    const httpServer = http.createServer(app);

    // WebSocket Server for Subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql',
    });

    useServer(
      {
        schema,
        context: createWebSocketContext,
      },
      wsServer
    );

    Logger.info('✅ WS subscriptions enabled');

    // Socket.IO (optional, if you need it)
    socketIoServer(httpServer);

    // Health Check
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Start Listening
    httpServer.listen(HTTP_PORT, () => {
      Logger.success(`🌐 HTTP: http://localhost:${HTTP_PORT}`);
      Logger.success(
        `🚀 GraphQL: http://localhost:${HTTP_PORT}${apolloServer.graphqlPath}`
      );
      Logger.success(
        `📡 Subscriptions: ws://localhost:${HTTP_PORT}${apolloServer.graphqlPath}`
      );
    });
  } catch (error) {
    Logger.error('❌ Server start failed:', error);
    process.exit(1);
  }
}

startServer();
