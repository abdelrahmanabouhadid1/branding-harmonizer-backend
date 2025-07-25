import express from "express";
import sql from "../config/database.js";

const router = express.Router();

// Get files by course ID
router.get("/course/:course_id", async (req, res) => {
  try {
    const { course_id } = req.params;

    if (!course_id) {
      return res.status(400).json({ error: "Course ID is required" });
    }

    const files = await sql`
      SELECT 
        cf.*,
        (
          SELECT json_agg(cl.* ORDER BY cl.order_index DESC)
          FROM coursesLessons cl
          WHERE cl.file_id = cf.id 
        ) as lessons
      FROM coursesFiles cf
      JOIN courses c ON cf.course_id = c.id
      WHERE cf.course_id = ${course_id}
      ORDER BY cf.created_at DESC
    `;

    res.json(files);
  } catch (error) {
    console.error("Error fetching course files:", error);
    res.status(500).json({ error: "Failed to fetch course files" });
  }
});

// Create a new course file
router.post("/", async (req, res) => {
  try {
    const { name, course_id } = req.body;

    if (!name || !course_id) {
      return res.status(400).json({ error: "Name and course_id are required" });
    }

    const [newFile] = await sql`
      INSERT INTO coursesFiles (
        name,
        course_id
      )
      VALUES (
        ${name},
        ${course_id}
      )
      RETURNING *
    `;

    res.status(201).json(newFile);
  } catch (error) {
    console.error("Error creating course file:", error);
    res.status(500).json({ error: "Failed to create course file" });
  }
});

// Delete a course file by ID and its associated lessons
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "File ID is required" });
    }

    // First, delete all lessons associated with this file
    const deletedLessons = await sql`
      DELETE FROM courseslessons 
      WHERE file_id = ${id}
      RETURNING *
    `;

    // Then delete the file itself
    const [deletedFile] = await sql`
      DELETE FROM coursesfiles 
      WHERE id = ${id}
      RETURNING *
    `;

    if (!deletedFile) {
      return res.status(404).json({ error: "Course file not found" });
    }

    res.status(200).json({
      message: "Course file and associated lessons deleted successfully",
      file: deletedFile,
      deletedLessonsCount: deletedLessons.length,
    });
  } catch (error) {
    console.error("Error deleting course file:", error);
    res.status(500).json({ error: "Failed to delete course file" });
  }
});

export default router;
