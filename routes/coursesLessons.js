import express from "express";
import sql from "../config/database.js";

const router = express.Router();

// Create a new lesson
router.post("/", async (req, res) => {
  try {
    const { title, duration, points, video_url, content, file_id } = req.body;

    if (!title || !file_id || !course_id) {
      return res
        .status(400)
        .json({ error: "Title, file_id, and course_id are required" });
    }

    const [newLesson] = await sql`
      INSERT INTO coursesLessons (
        title,
        duration,
        points,
        video_url,
        content,
        file_id,
      )
      VALUES (
        ${title},
        ${duration},
        ${points},
        ${video_url},
        ${content},
        ${file_id},
      )
      RETURNING *
    `;

    res.status(201).json(newLesson);
  } catch (error) {
    console.error("Error creating course lesson:", error);
    res.status(500).json({ error: "Failed to create course lesson" });
  }
});

export default router;
