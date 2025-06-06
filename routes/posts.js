import express from "express";
import sql from "../config/database.js";

const router = express.Router({ mergeParams: true });

// Get all posts for a community
router.get("/", async (req, res) => {
  try {
    const { community_id } = req.params;

    if (!community_id) {
      return res.status(400).json({ error: "Community ID is required" });
    }

    const posts = await sql`
      SELECT 
        p.id,
        json_build_object(
          'uid', u.uid,
          'email', u.email,
          'displayName', u.display_name,
          'photoURL', u.photo_url,
          'role', u.role
        ) as author,
        p.author_id as "authorId",
        p.content,
        p.is_pinned as "isPinned",
        p.likes,
        p.title, 
        p.comments_count as comments,
        p.created_at as "timeAgo",
        c.name as "category"
      FROM posts p 
      JOIN categories c on p.category_id = c.id 
      JOIN users u on p.author_id = u.uid
      WHERE p.community_id = ${community_id}
      ORDER BY p.is_pinned DESC, p.created_at DESC
    `;
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Create a new post
router.post("/", async (req, res) => {
  try {
    const { content, isPinned, category_id, authorId, title, community_id } =
      req.body;

    if (!community_id) {
      return res.status(400).json({ error: "Community ID is required" });
    }

    const [newPost] = await sql`
      INSERT INTO posts (content, is_pinned, category_id, author_id, title, community_id)
      VALUES (${content}, ${isPinned}, ${category_id}, ${authorId}, ${title}, ${community_id})
      RETURNING *
    `;
    res.json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Update a post
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isPinned } = req.body;
    const [updatedPost] = await sql`
      UPDATE posts 
      SET content = ${content}, is_pinned = ${isPinned}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updatedPost) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(updatedPost);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// Delete a post
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await sql`DELETE FROM posts WHERE id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// Like/Unlike a post
router.post("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    console.log("post id : ", id);
    console.log("userId : ", userId);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Start a transaction with SERIALIZABLE isolation level
    const result = await sql.begin(async (sql) => {
      // Set transaction isolation level to SERIALIZABLE
      await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

      // Check if user already liked the post
      const existingLike = await sql`
        SELECT id FROM likes 
        WHERE post_id = ${id} AND user_id = ${userId}
      `;
      console.log("existingLike : ", existingLike);
      if (existingLike.length > 0) {
        // Unlike: Remove the like and decrease count
        await sql`
          DELETE FROM likes 
          WHERE post_id = ${id} AND user_id = ${userId}
        `;
        console.log("deleted from likes table ");
        const [updatedPost] = await sql`
          UPDATE posts 
          SET likes = likes - 1 
          WHERE id = ${id}
          RETURNING id, likes
        `;
        console.log("updatedPost unlike : ", updatedPost);
        return { action: "unliked", likes: updatedPost.likes };
      } else {
        // Like: Add the like and increase count
        await sql`
          INSERT INTO likes (post_id, user_id, created_at)
          VALUES (${id}, ${userId}, CURRENT_TIMESTAMP)
        `;
        console.log("added to likes table ");
        const [updatedPost] = await sql`
          UPDATE posts 
          SET likes = likes + 1 
          WHERE id = ${id}
          RETURNING id, likes
        `;
        console.log("updatedPost like : ", updatedPost);
        return { action: "liked", likes: updatedPost.likes };
      }
    });

    res.json(result);
  } catch (error) {
    console.error("Error handling like:", error);
    res.status(500).json({ error: "Failed to process like" });
  }
});

// Get likes for a specific post
router.get("/:id/likes", async (req, res) => {
  try {
    const { id } = req.params;

    const likes = await sql`
      SELECT 
        l.id,
        l.user_id as "userId",
        l.created_at as "createdAt",
        p.likes as "totalLikes"
      FROM likes l
      JOIN posts p ON p.id = l.post_id
      WHERE l.post_id = ${id}
      ORDER BY l.created_at DESC
    `;

    res.json(likes);
  } catch (error) {
    console.error("Error fetching post likes:", error);
    res.status(500).json({ error: "Failed to fetch post likes" });
  }
});

// Get comments for a post
router.get("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;

    const comments = await sql`
      SELECT 
        c.id,
        c.author_id as "authorId",
        c.post_id as "postId",
        c.content,
        c.created_at as "createdAt",
        c.parent_comment_id as "parentCommentId",
         json_build_object(
          'uid', u.uid,
          'email', u.email,
          'displayName', u.display_name,
          'photoURL', u.photo_url,
          'role', u.role
        ) as author

      FROM comments c LEFT JOIN users u ON c.author_id = u.uid
      WHERE c.post_id = ${id}
      ORDER BY c.created_at DESC
    `;

    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Add a comment to a post
router.post("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { authorId, content, parentCommentId } = req.body;

    if (!authorId || !content) {
      return res
        .status(400)
        .json({ error: "Author ID and content are required" });
    }

    // Start a transaction with SERIALIZABLE isolation level
    const result = await sql.begin(async (sql) => {
      // Set transaction isolation level to SERIALIZABLE
      await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

      // Insert the comment
      const [newComment] = await sql`
        INSERT INTO comments (post_id, author_id, content, parent_comment_id,created_at)
        VALUES (${id}, ${authorId}, ${content}, ${
        parentCommentId || null
      },CURRENT_TIMESTAMP)
        RETURNING id, post_id as "postId", author_id as "authorId", content, created_at as "createdAt", parent_comment_id as "parentCommentId"
      `;

      // Update the post's comment count
      await sql`
        UPDATE posts 
        SET comments_count = comments_count + 1 
        WHERE id = ${id}
      `;

      return {
        ...newComment,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

export default router;
