import express from "express";
import sql from "../config/database.js";

const router = express.Router();

// Create/Update user
router.post("/", async (req, res) => {
  const { uid, email, displayName, photoURL } = req.body;
  console.log("user :", req.body);
  try {
    const result = await sql`
      INSERT INTO users (uid, email, display_name, photo_url)
      VALUES (${uid}, ${email}, ${displayName}, ${photoURL})
      ON CONFLICT (uid) DO UPDATE
      SET email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          photo_url = EXCLUDED.photo_url,
          role = EXCLUDED.role
    `;

    res.json(result[0]);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Get all posts liked by a user
router.get("/:userId/liked-posts", async (req, res) => {
  try {
    const { userId } = req.params;

    const likedPosts = await sql`
      SELECT post_id as "postId"
      FROM likes
      WHERE user_id = ${userId}
    `;

    res.json(likedPosts.map((post) => post.postId));
  } catch (error) {
    console.error("Error fetching user liked posts:", error);
    res.status(500).json({ error: "Failed to fetch liked posts" });
  }
});

export default router;
