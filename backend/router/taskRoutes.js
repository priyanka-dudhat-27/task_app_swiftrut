const express = require("express");
const router = express.Router();
const {
  createTask,
  getTasks,
  deleteTask,
  editTask,
  bulkCreateTasks,
} = require("../controller/taskController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", authMiddleware, createTask);
router.get("/get", authMiddleware, getTasks);
router.delete("/delete/:id", authMiddleware, deleteTask);
router.put("/edit/:id", authMiddleware, editTask);
router.post("/bulk-create", authMiddleware, bulkCreateTasks);
// router.get("/users", authMiddleware, getAllUsers);

module.exports = router;
