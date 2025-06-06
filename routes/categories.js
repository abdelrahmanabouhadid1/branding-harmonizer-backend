import express from "express";
import sql from "../config/database.js";

const router = express.Router();

// Get all categories
router.get("/", async (req, res) => {
  try {
    const categories = await sql`
      SELECT id, name
      FROM categories
      ORDER BY name ASC
    `;
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
