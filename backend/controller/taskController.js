const mongoose = require("mongoose");
const TaskModel = require("../models/Task");
const { getIO } = require("../socket");
const UserModel = require("../models/User");

const createTask = async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const userId = req.user.user.id;
    const task = await TaskModel.create({
      Task: title,
      Description: description,
      Status: status,
      AssignedBy: userId,
    });
    task.save();
    getIO().emit("new-task", task);
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: error.message });
  }
};

const getTasks = async (req, res) => {
  try {
    const userId = req.user.user.id;
    const tasks = await TaskModel.find({ AssignedBy: userId });
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user.id;

    const task = await TaskModel.findByIdAndDelete(id);
    if (!task) {
      return res
        .status(404)
        .json({ error: "Task not found or already deleted" });
    }

    getIO().emit("delete-task", { id: task._id, status: task.Status });
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const editTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;
    const userId = req.user.user.id;

    const task = await TaskModel.findOneAndUpdate(
      { _id: id },
      {
        Task: title,
        Description: description,
        Status: status,
        UpdatedAt: new Date(),
      },
      { new: true }
    );

    if (!task) {
      return res
        .status(404)
        .json({ error: "Task not found or not authorized" });
    }
    getIO().emit("task-updated", task);
    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const bulkCreateTasks = async (req, res) => {
  try {
    const tasks = Array.isArray(req.body) ? req.body : [req.body];
    const userId = req.user.user.id;
    const createdTasks = [];

    if (tasks.length === 0) {
      return res.status(400).json({ error: "No tasks provided" });
    }

    for (let task of tasks) {
      let assignedTo = userId;

      // If AssignedTo is a non-empty string, try to find the user by name
      if (typeof task.AssignedTo === 'string' && task.AssignedTo.trim() !== '') {
        const user = await UserModel.findOne({ name: task.AssignedTo });
        if (user) {
          assignedTo = user._id;
        } else {
          console.warn(`User "${task.AssignedTo}" not found. Assigning task to creator.`);
        }
      }

      const newTask = await TaskModel.create({
        Task: task.Title,
        Description: task.Description,
        Status: task.Status,
        DueDate: task.DueDate,
        Priority: task.Priority,
        AssignedBy: userId,
        AssignedTo: assignedTo,
      });

      await newTask.save();
      createdTasks.push(newTask);
      getIO().emit("new-task", newTask);
    }

    res.status(201).json(createdTasks);
  } catch (error) {
    console.error("Error bulk creating tasks:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createTask,
  getTasks,
  deleteTask,
  editTask,
  bulkCreateTasks,
};
