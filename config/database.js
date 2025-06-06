import postgres from "postgres";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .backend.env
dotenv.config({ path: path.resolve(process.cwd(), ".backend.env") });

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

export default sql;
