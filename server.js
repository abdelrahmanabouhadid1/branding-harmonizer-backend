import express from "express";
import cors from "cors";
import postgres from "postgres";
import dotenv from "dotenv";
import path from "path";

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

// Get all posts
app.get("/api/posts", async (req, res) => {
  try {
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
      FROM posts p join categories c on p.category_id = c.id join users u on p.author_id = u.uid
      ORDER BY p.is_pinned DESC, p.created_at DESC
    `;
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Create a new post
app.post("/api/posts", async (req, res) => {
  try {
    const { content, isPinned, category_id, authorId, title } = req.body;
    const [newPost] = await sql`
      INSERT INTO posts ( content, is_pinned, category_id,author_id,title )
      VALUES ( ${content}, ${isPinned}, ${category_id},${authorId},${title})
      RETURNING *
    `;
    res.json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Update a post
app.put("/api/posts/:id", async (req, res) => {
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
app.delete("/api/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await sql`DELETE FROM posts WHERE id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// Get all categories
app.get("/api/categories", async (req, res) => {
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

// Like/Unlike a post
app.post("/api/posts/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

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

      if (existingLike.length > 0) {
        // Unlike: Remove the like and decrease count
        await sql`
          DELETE FROM likes 
          WHERE post_id = ${id} AND user_id = ${userId}
        `;
        const [updatedPost] = await sql`
          UPDATE posts 
          SET likes = likes - 1 
          WHERE id = ${id}
          RETURNING id, likes
        `;
        return { action: "unliked", likes: updatedPost.likes };
      } else {
        // Like: Add the like and increase count
        await sql`
          INSERT INTO likes (post_id, user_id, created_at)
          VALUES (${id}, ${userId}, CURRENT_TIMESTAMP)
        `;
        const [updatedPost] = await sql`
          UPDATE posts 
          SET likes = likes + 1 
          WHERE id = ${id}
          RETURNING id, likes
        `;
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
app.get("/api/posts/:id/likes", async (req, res) => {
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

// Get all posts liked by a user
app.get("/api/users/:userId/liked-posts", async (req, res) => {
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

// Get comments for a post
app.get("/api/posts/:id/comments", async (req, res) => {
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
app.post("/api/posts/:id/comments", async (req, res) => {
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

      // Get user info for the response

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

// Delete a comment
app.delete("/api/comments/:id", async (req, res) => {
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

app.post("/api/users", async (req, res) => {
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
