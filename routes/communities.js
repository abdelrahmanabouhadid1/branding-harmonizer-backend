import express from "express";
import sql from "../config/database.js";
import postsRouter from "./posts.js";

const router = express.Router();

// Get all communities

router.use("/:community_id/posts", postsRouter);
router.get("/", async (req, res) => {
  try {
    const communities = await sql`
      SELECT 
        id,
        name,
        description,
        type,
        language,
        member_count,
        created_at,
        updated_at
      FROM communities
      ORDER BY created_at DESC
    `;
    res.json(communities);
  } catch (error) {
    console.error("Error fetching communities:", error);
    res.status(500).json({ error: "Failed to fetch communities" });
  }
});

export default router;
