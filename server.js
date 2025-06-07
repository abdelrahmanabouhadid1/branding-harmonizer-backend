import express from "express";
import cors from "cors";
import postgres from "postgres";
import dotenv from "dotenv";
import path from "path";

// Import routers
import postsRouter from "./routes/posts.js";
import commentsRouter from "./routes/comments.js";
import usersRouter from "./routes/users.js";
import categoriesRouter from "./routes/categories.js";
import communitiesRouter from "./routes/communities.js";
import coursesRouter from "./routes/courses.js";

// Load environment variables from .backend.env
console.log(path.resolve(process.cwd(), ".backend.env"));
dotenv.config({ path: path.resolve(process.cwd(), ".backend.env") });

// Log environment variables (for debugging)
console.log("Database Configuration:");
console.log("Host:", process.env.DB_HOST);
console.log("Port:", process.env.DB_PORT);
console.log("Database:", process.env.DB_NAME);
console.log("Username:", process.env.DB_USER);
console.log("Password:", process.env.DB_PASSWORD);

const app = express();
app.use(cors());
app.use(express.json());

// Create postgres client with error handling
let sql;
try {
  sql = postgres({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }, // <- THIS is what works with Supabase
    max: 10,
    idle_timeout: 20,
  });
  console.log("PostgreSQL client created successfully");
} catch (error) {
  console.error("Error creating PostgreSQL client:", error);
  process.exit(1);
}

// Test database connection
async function testConnection() {
  try {
    await sql`SELECT 1`;
    console.log("Successfully connected to the database");
  } catch (error) {
    console.error("Error connecting to the database:", error);
    process.exit(1);
  }
}

// Call test connection
testConnection();

// Use routers
app.use("/api/posts", postsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/communities", communitiesRouter);
app.use("/api/courses", coursesRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
