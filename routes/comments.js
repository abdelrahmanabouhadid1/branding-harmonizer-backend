import express from "express";
import sql from "../config/database.js";

const router = express.Router();

// Delete a comment
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Start a transaction with SERIALIZABLE isolation level
    const result = await sql.begin(async (sql) => {
      // Set transaction isolation level to SERIALIZABLE
      await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

      // Get the comment's post_id before deleting
      const [comment] = await sql`
        SELECT post_id FROM comments WHERE id = ${id}
      `;

      if (!comment) {
        throw new Error("Comment not found");
      }

      // Delete the comment
      await sql`
        DELETE FROM comments WHERE id = ${id}
      `;

      // Update the post's comment count
      await sql`
        UPDATE posts 
        SET comments_count = comments_count - 1 
        WHERE id = ${comment.post_id}
      `;

      return { success: true };
    });

    res.json(result);
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
