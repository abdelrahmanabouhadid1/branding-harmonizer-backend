import express from "express";
import sql from "../config/database.js";

const router = express.Router();

// Get courses by community ID
router.get("/community/:community_id", async (req, res) => {
  try {
    const { community_id } = req.params;

    if (!community_id) {
      return res.status(400).json({ error: "Community ID is required" });
    }

    const courses = await sql`
      SELECT 
        c.*,
        json_build_object(
          'id', com.id,
          'name', com.name,
          'type', com.type
        ) as community
      FROM courses c
      JOIN communities com ON c.community_id = com.id
      WHERE c.community_id = ${community_id}
      ORDER BY c.created_at DESC
    `;

    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// Create a new course
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      level,
      cover_image,
      published,
      community_id,
    } = req.body;

    // Validate required fields
    if (!name || !community_id) {
      return res
        .status(400)
        .json({ error: "Name and community_id are required" });
    }

    // Validate type and level if provided
    if (type && !["paid", "free"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Type must be either 'paid' or 'free'" });
    }

    if (level && !["Beginner", "Intermediate", "Advanced"].includes(level)) {
      return res.status(400).json({
        error: "Level must be either 'Beginner', 'Intermediate', or 'Advanced'",
      });
    }

    const [newCourse] = await sql`
      INSERT INTO courses (
        name,
        description,
        type,
        level,
        cover_image,
        published,
        community_id
      )
      VALUES (
        ${name},
        ${description},
        ${type},
        ${level},
        ${cover_image},
        ${published},
        ${community_id}
      )
      RETURNING *
    `;

    res.status(201).json(newCourse);
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ error: "Failed to create course" });
  }
});

// Delete a specific course
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists
    const [course] = await sql`
      SELECT id FROM courses WHERE id = ${id}
    `;

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Delete the course
    await sql`
      DELETE FROM courses WHERE id = ${id}
    `;

    res.json({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "Failed to delete course" });
  }
});

export default router;
