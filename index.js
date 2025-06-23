import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { makeExecutableSchema } from "@graphql-tools/schema";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { socketIoServer } from "./ws/socket.js";
import connectDb from "./config/dbConfig.js";
import { typeDefs, resolvers } from "./graphql/schema.js";

dotenv.config({ path: "./.env" });

const app = express();
const httpServer = http.createServer(app);

// Connect MongoDB
connectDb(process.env.DATABASE_URL);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use(cookieParser());


// Create GraphQL schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create Apollo server
const apolloServer = new ApolloServer({
  schema,
  introspection: true,
  context: ({ req, res }) => ({ req, res }), // Pass req & res
  formatError: (error) => {
    // Extract custom status codes from error message
    const [statusCode, message] = error.message.split(": ");

    return {
      success: false,
      statusCode: Number(statusCode) || 500, // Default to 500 if missing
      message: message || "Internal Server Error",
    };
  },
});
await apolloServer.start();
apolloServer.applyMiddleware({ app, path: "/graphql" });
socketIoServer(httpServer);

// Start server
const PORT = process.env.PORT || 8595;
httpServer.listen(PORT, () => {
  console.log(`🌏 REST & GraphQL server running at http://localhost:${PORT}`);
  console.log(`🧠 GraphQL endpoint at http://localhost:${PORT}${apolloServer.graphqlPath}`);
});