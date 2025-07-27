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

import connectDb from './config/dbConfig.js';
import { resolvers, typeDefs } from './graphql/schema.js';
import { Logger } from './utils/logger.js';
import { socketIoServer } from './ws/socket.js';

dotenv.config({ path: './.env' });

const app = express();

// Load SSL cert
const sslOptions = {
  key: fs.readFileSync('./ssl/server.key'),
  cert: fs.readFileSync('./ssl/server.cert'),
};

const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslOptions, app);

// Connect MongoDB
connectDb(process.env.DATABASE_URL);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.disable('x-powered-by');
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(cookieParser());

// Create GraphQL schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create Apollo server
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

// Setup Socket.IO on both servers
socketIoServer(httpServer);
socketIoServer(httpsServer);

// Start HTTP and HTTPS servers
const HTTP_PORT = process.env.PORT || 9095;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  Logger.success(`🌐 HTTP server: http://<IP>:${HTTP_PORT}`);
  Logger.success(
    `🚀 GraphQL:    http://<IP>:${HTTP_PORT}${apolloServer.graphqlPath}`
  );
});

httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
  Logger.success(`🔐 HTTPS server: https://<IP>:${HTTPS_PORT}`);
  Logger.success(
    `🧠 Secure GraphQL: https://<IP>:${HTTPS_PORT}${apolloServer.graphqlPath}`
  );
});
