import React, { useState, useEffect, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { toast } from "react-hot-toast";
import axios from "axios";
import io from 'socket.io-client';
import { motion, AnimatePresence } from "framer-motion";
import Papa from 'papaparse';

const API_URL = import.meta.env.VITE_API_URL;
const socket = io(API_URL);

function Todo() {
  const [todos, setTodos] = useState({ current: [], pending: [], completed: [] });
  const [todo, setTodo] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const fileInputRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchCurrentUser(); // New function to fetch current user from local storage

    socket.on('update-task-list', (updatedTask) => {
      setTodos(prev => ({
        ...prev,
        [updatedTask.Status]: prev[updatedTask.Status]?.map(task =>
          task._id === updatedTask._id ? updatedTask : task
        ) || []
      }));
      fetchTasks();
    });

    socket.on('add-new-task', (newTask) => {
      setTodos(prev => {
        const status = newTask.status || 'current';
        fetchTasks();
        return {
          ...prev,
          [status]: Array.isArray(prev[status])
            ? [...prev[status], newTask]
            : [newTask]
        };
      });
    });

    socket.on('delete-task', ({ id, status }) => {
      setTodos(prev => ({
        ...prev,
        [status]: prev[status].filter(todo => todo._id !== id)
      }));
    });

    return () => {
      socket.off('update-task-list');
      socket.off('add-new-task');
      socket.off('delete-task');
    };
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/get`, getAuthHeaders());
      const tasks = response.data;
      setTodos({
        current: tasks.filter(task => task.Status === 'current'),
        pending: tasks.filter(task => task.Status === 'pending'),
        completed: tasks.filter(task => task.Status === 'completed')
      });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to fetch tasks");
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, getAuthHeaders());
      setUsers(response.data);
    } catch (error) {
      toast.error("Failed to fetch users");
      console.error(error);
    }
  };

  const fetchCurrentUser = () => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      setCurrentUser(user);
    }
  };

  const addTodo = async () => {
    if (todo.trim() === "") return;

    try {
      const response = await axios.post(`${API_URL}/api/create`, {
        title: todo,
        description: "",
        status: "current",
        priority: "Medium", // Default priority
        assignedTo: currentUser ? currentUser.id : null // Assign to current user if available
      }, getAuthHeaders());

      socket.emit('new-task', response.data);

      setTodos(prev => ({
        ...prev,
        current: [...prev.current, response.data]
      }));
      setTodo("");
      toast.success("Todo added successfully!");
    } catch (error) {
      console.error("Error adding todo:", error.response?.data || error.message);
      toast.error("Failed to add todo");
    }
  };

  const deleteTodo = async (id, status) => {
    try {
      await axios.delete(`${API_URL}/api/delete/${id}`, getAuthHeaders());
      setTodos(prev => ({
        ...prev,
        [status]: prev[status].filter(todo => todo._id !== id)
      }));
      toast.success("Todo deleted!");
    } catch (error) {
      toast.error("Failed to delete todo");
      console.error(error);
    }
  };

  const editTodo = (id, status) => {
    setIsEditing(true);
    setEditId(id);
    const todoToEdit = todos[status].find(todo => todo._id === id);
    setTodo(todoToEdit.Task);
  };

  const updateTodo = async () => {
    try {
      const response = await axios.put(`${API_URL}/api/edit/${editId}`, {
        title: todo,
        description: "",
        status: "current",
        priority: editingTodo.priority,
        assignedTo: editingTodo.assignedTo
      }, getAuthHeaders());

      socket.emit('task-updated', response.data);

      setTodos(prev => ({
        ...prev,
        current: prev.current.map(item =>
          item._id === editId ? response.data : item
        ),
        pending: prev.pending.map(item =>
          item._id === editId ? response.data : item
        ),
        completed: prev.completed.map(item =>
          item._id === editId ? response.data : item
        )
      }));
      setIsEditing(false);
      setEditId(null);
      setTodo("");
      toast.success("Todo updated successfully!");
      fetchTasks();
    } catch (error) {
      toast.error("Failed to update todo");
      console.error(error);
    }
  };

  const changeStatus = async (id, currentStatus, newStatus) => {
    try {
      const response = await axios.put(`${API_URL}/api/edit/${id}`, {
        status: newStatus
      }, getAuthHeaders());

      socket.emit('task-updated', response.data);

      setTodos(prev => ({
        ...prev,
        [currentStatus]: prev[currentStatus].filter(todo => todo._id !== id),
        [newStatus]: [...prev[newStatus], response.data]
      }));
      toast.success(`Todo moved to ${newStatus}!`);
      fetchTasks();
    } catch (error) {
      toast.error("Failed to update todo status");
      console.error(error);
    }
  };

  const onDragEnd = async (result) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    const newTodos = { ...todos };
    const [movedTask] = newTodos[sourceStatus].splice(source.index, 1);
    newTodos[destStatus].splice(destination.index, 0, movedTask);

    setTodos(newTodos);

    if (sourceStatus !== destStatus) {
      try {
        await axios.put(`${API_URL}/api/edit/${movedTask._id}`, {
          status: destStatus
        }, getAuthHeaders());
        toast.success("Task status updated successfully!");
      } catch (error) {
        toast.error("Failed to update task status");
        console.error(error);
        fetchTasks();
      }
    }
  };

  const bulkCreateTasks = async (parsedData) => {
    try {
      // Format the data to match the expected structure
      const formattedTasks = parsedData.map(task => ({
        Title: task.Title,
        Description: task.Description || "",
        Status: task.Status || "current",
        DueDate: task.DueDate || null,
        Priority: task.Priority || "Medium",
        AssignedTo: task.AssignedTo || ""
      }));

      const response = await axios.post(`${API_URL}/api/bulk-create`, formattedTasks, getAuthHeaders());
      toast.success(`Created ${response.data.length} tasks successfully!`);
      fetchTasks();
    } catch (error) {
      console.error("Error in bulk creating tasks:", error);
      toast.error("Failed to create tasks: " + (error.response?.data?.error || error.message));
      if (error.response?.data?.errors) {
        downloadErrorLog(error.response.data.errors);
      }
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        complete: async (results) => {
          console.log(results, "<<<<<<<<<<<<<<<<<<<<<<<<<<< RESULTS");
          try {
            await bulkCreateTasks(results.data);
          } catch (error) {
            console.error("Error processing CSV:", error);
            toast.error("Failed to process CSV file");
            downloadErrorLog([error.message]);
          }
        },
        header: true,
        error: (error) => {
          toast.error("Error parsing CSV file");
          downloadErrorLog([error.message]);
        }
      });
    }
  };

  const downloadErrorLog = (errors) => {
    const csvContent = Papa.unparse({
      fields: ["Error"],
      data: errors.map(error => [error])
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "error_log.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportTasks = () => {
    const allTasks = [...todos.current, ...todos.pending, ...todos.completed];
    const csvContent = Papa.unparse({
      fields: ["Title", "Description", "Status", "DueDate", "Priority", "AssignedTo"],
      data: allTasks.map(task => [
        task.Task,
        task.Description || "",
        task.Status,
        task.DueDate || "",
        task.Priority || "",
        task.AssignedTo || ""
      ])
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "all_tasks.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto p-4 max-w-6xl"
    >
      <form onSubmit={(e) => e.preventDefault()} className="mb-8 flex">
        <input
          type="text"
          value={todo}
          onChange={(e) => setTodo(e.target.value)}
          className="flex-grow border border-gray-300 p-3 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter a new todo"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={isEditing ? updateTodo : addTodo}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-r-lg transition duration: 300 ease-in-out min-w-[100px]"
        >
          {isEditing ? "Update" : "Add"}
        </motion.button>
      </form>
      <div className="mb-8 flex space-x-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg transition duration-300 ease-in-out"
          >
            Import Tasks from CSV
          </button>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <button
            onClick={exportTasks}
            className="bg-purple-500 hover:bg-purple-600 text-white p-3 rounded-lg transition duration-300 ease-in-out"
          >
            Export All Tasks to CSV
          </button>
        </motion.div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col md:flex-row gap-6">
          {['current', 'pending', 'completed'].map((status) => (
            <Droppable droppableId={status} key={status}>
              {(provided) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="flex-1 p-4 bg-gray-100 rounded-lg shadow-md"
                >
                  <h2 className="text-xl font-bold mb-4 capitalize text-gray-700">{status}</h2>
                  <AnimatePresence>
                    {todos[status].map((todo, index) => (
                      <Draggable key={todo._id} draggableId={todo._id.toString()} index={index}>
                        {(provided) => (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="bg-white p-3 mb-3 rounded-lg shadow-sm hover:shadow-md transition duration-300 ease-in-out"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {status !== 'current' && (
                                  <input
                                    type="checkbox"
                                    checked={status === 'completed'}
                                    onChange={() => changeStatus(todo._id, status, status === 'pending' ? 'completed' : 'pending')}
                                    className="mr-3 h-5 w-5 text-blue-500"
                                  />
                                )}
                                <span className={`${status === 'completed' ? "line-through text-gray-500" : "text-gray-700"} text-lg`}>
                                  {todo.Task}
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <div className="text-sm text-gray-500">
                                  Priority: {todo.Priority}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Assigned to: {todo.AssignedTo ? todo.AssignedTo.name : (currentUser ? currentUser.name : 'Unassigned')}
                                </div>
                                <div className="flex space-x-2 mt-2">
                                  {status === 'current' && (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => changeStatus(todo._id, 'current', 'pending')}
                                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-sm transition duration-300 ease-in-out"
                                    >
                                      Start
                                    </motion.button>
                                  )}
                                  {status === 'current' && (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => editTodo(todo._id, status)}
                                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-full text-sm transition duration-300 ease-in-out"
                                    >
                                      Edit
                                    </motion.button>
                                  )}
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => deleteTodo(todo._id, status)}
                                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm transition duration-300 ease-in-out"
                                  >
                                    Delete
                                  </motion.button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </Draggable>
                    ))}
                  </AnimatePresence>
                  {provided.placeholder}
                </motion.div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </motion.div>
  );
}

export default Todo;