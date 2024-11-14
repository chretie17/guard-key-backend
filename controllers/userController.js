const bcrypt = require('bcryptjs');
const db = require('../config/db'); // No need to call .promise() here

// Create a new user
exports.createUser = async (req, res) => {
    const { email, username, password, role } = req.body;
    
    // Validate required fields
    if (!email || !username || !password || !role) {
        console.error("Missing required fields:", { email, username, password, role });
        return res.status(400).json({ error: "All fields (email, username, password, role) are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)";
        await db.query(query, [email, username, hashedPassword, role]);
        res.status(201).json({ message: "User created successfully" });
    } catch (err) {
        console.error("Error creating user:", err);  // Log the error details
        res.status(500).json({ error: "Error creating user" });
    }
};

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const [results] = await db.query("SELECT id, email, username, role FROM users");
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Error fetching users" });
    }
};

// Update a user
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { email, username, role } = req.body;
    const query = "UPDATE users SET email = ?, username = ?, role = ? WHERE id = ?";
    try {
        await db.query(query, [email, username, role, id]);
        res.json({ message: "User updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Error updating user" });
    }
};

// Delete a user
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM users WHERE id = ?", [id]);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Error deleting user" });
    }
};
