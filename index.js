import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
import path from 'path';

import connectDb from './config/dbConfig.js';
import { resolvers, typeDefs } from './graphql/schema.js';
import { Logger } from './utils/logger.js';
import { socketIoServer } from './ws/socket.js';

dotenv.config({ path: './.env' });

const app = express();
const __dirname = path.resolve();
const isProduction = process.env.NODE_ENV === 'production';
const useHttps = process.env.USE_HTTPS === 'true';

// Connect MongoDB
connectDb(process.env.DATABASE_URL);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.disable('x-powered-by');

app.use(
  cors({
    origin: '*', // or use a whitelist for production
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Create GraphQL schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

const apolloServer = new ApolloServer({
  schema,
  introspection: true,
  context: ({ req, res }) => ({ req, res }),
  formatError: (error) => {
    const [statusCode, message] = error.message.split(': ');
    return {
      success: false,
      statusCode: Number(statusCode) || 500,
      message: message || 'Internal Server Error',
    };
  },
});

await apolloServer.start();
apolloServer.applyMiddleware({ app, path: '/graphql' });

// Server creation logic
const HTTP_PORT = process.env.PORT || 9095;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;

const httpServer = http.createServer(app);

let httpsServer;
if (useHttps) {
  try {
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, './ssl/server.key')),
      cert: fs.readFileSync(path.join(__dirname, './ssl/server.cert')),
    };
    httpsServer = https.createServer(sslOptions, app);
  } catch (err) {
    Logger.error('❌ SSL cert/key not found or invalid.', err);
    process.exit(1);
  }
}

// Attach Socket.IO to servers
socketIoServer(httpServer);
if (useHttps && httpsServer) socketIoServer(httpsServer);

// Start HTTP server
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  Logger.success(`🌐 HTTP server: http://localhost:${HTTP_PORT}`);
  Logger.success(
    `🚀 GraphQL:    http://localhost:${HTTP_PORT}${apolloServer.graphqlPath}`
  );
});

// Start HTTPS server if enabled
if (useHttps && httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    Logger.success(`🔐 HTTPS server: https://localhost:${HTTPS_PORT}`);
    Logger.success(
      `🧠 Secure GraphQL: https://localhost:${HTTPS_PORT}${apolloServer.graphqlPath}`
    );
  });
}
