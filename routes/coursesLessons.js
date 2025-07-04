import express from "express";
import sql from "../config/database.js";

const router = express.Router();

// Create a new lesson
router.post("/", async (req, res) => {
  try {
    const { title, duration, points, content, file_id } = req.body;

    if (!title || !file_id) {
      return res.status(400).json({ error: "Title, file_id,  are required" });
    }

    const [newLesson] = await sql`
      INSERT INTO coursesLessons (
        title,
        duration,
        points,
        content,
        file_id
      )
      VALUES (
        ${title},
        ${duration},
        ${points},
        ${content},
        ${file_id}
      )
      RETURNING *
    `;

    res.status(201).json(newLesson);
  } catch (error) {
    console.error("Error creating course lesson:", error);
    res.status(500).json({ error: "Failed to create course lesson" });
  }
});

// Delete a lesson by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Lesson ID is required" });
    }

    const [deletedLesson] = await sql`
      DELETE FROM courseslessons 
      WHERE id = ${id}
      RETURNING *
    `;

    if (!deletedLesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res
      .status(200)
      .json({ message: "Lesson deleted successfully", lesson: deletedLesson });
  } catch (error) {
    console.error("Error deleting course lesson:", error);
    res.status(500).json({ error: "Failed to delete course lesson" });
  }
});

// Update a lesson by ID (excluding file_id)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, duration, points, content } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const [updatedLesson] = await sql`
      UPDATE courseslessons
      SET title = ${title}, duration = ${duration}, points = ${points}, content = ${content}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updatedLesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.status(200).json(updatedLesson);
  } catch (error) {
    console.error("Error updating lesson:", error);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

export default router;
