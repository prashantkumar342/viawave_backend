import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { useServer } from 'graphql-ws/use/ws';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import indexRouter from './routes/routes.js';
import { graphqlUploadExpress } from "graphql-upload-minimal";

import connectDb from './config/dbConfig.js';
import { resolvers, typeDefs } from './graphql/schema.js';
import { Logger } from './utils/logger.js';
import { requireAuth } from './utils/requireAuth.js';

// ----------------------
// Load Env
// ----------------------
dotenv.config({ path: './.env' });

// ----------------------
// Error Handlers
// ----------------------
process.on('unhandledRejection', (reason) => {
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
    // Extract token from connection params
    let token =
      ctx.connectionParams?.Authorization ||
      ctx.connectionParams?.authorization ||
      ctx.connectionParams?.token;

    console.log('WS Connection Params:', ctx.connectionParams);
    console.log('Extracted Token:', token);

    if (!token) {
      Logger.warn('WS connection without token');
      return { user: null, authenticated: false };
    }

    // Remove 'Bearer ' prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    // 🔥 CRITICAL FIX: Pass token in the format requireAuth expects
    // requireAuth expects either a req object or an object with token property
    const user = await requireAuth({ token });

    console.log('WS Auth Success:', user?.username || user?.id);
    return { user, authenticated: true, req: { token } }; // Include req-like object

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
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Add graphql upload middleware BEFORE Apollo Server
    app.use('/graphql', graphqlUploadExpress({
      maxFileSize: 50_000_000, // 50MB
      maxFiles: 5
    }));

    // Serve static files from public directory
    app.use(
      '/uploads',
      express.static(path.join(__dirname, 'public', 'uploads'))
    );

    // GraphQL Schema
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    // Apollo Server
    const apolloServer = new ApolloServer({
      schema,
      introspection: true,
      context: async ({ req, res }) => {
        let user = null;
        try {
          if (req) {
            user = await requireAuth(req);
          }
        } catch (err) {
          Logger.warn(`HTTP auth failed: ${err.message}`);
        }
        return { req, res, user };
      },
      // Disable built-in file upload handling since we're using graphql-upload-minimal
      uploads: false,
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

    // Health Check
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    app.use('/', indexRouter);

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