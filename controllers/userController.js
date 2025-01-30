const bcrypt = require('bcryptjs');
const db = require('../config/db'); // No need to call .promise() here

// Create a new user
exports.createUser = async (req, res) => {
    const { email, username, password, role, phone } = req.body;
    
    // Validate required fields
    if (!email || !username || !password || !role || !phone) {
        console.error("Missing required fields:", { email, username, password, role, phone });
        return res.status(400).json({ error: "All fields (email, username, password, role, phone) are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = "INSERT INTO users (email, username, password, role, phone) VALUES (?, ?, ?, ?, ?)";
        await db.query(query, [email, username, hashedPassword, role, phone]);
        res.status(201).json({ message: "User created successfully" });
    } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).json({ error: "Error creating user" });
    }
};

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const [results] = await db.query("SELECT id, email, username, role, phone FROM users");
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Error fetching users" });
    }
};

// Update a user
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { email, username, role, phone } = req.body;

    // Validate required fields
    if (!email || !username || !role || !phone) {
        return res.status(400).json({ error: "All fields (email, username, role, phone) are required." });
    }

    try {
        const query = "UPDATE users SET email = ?, username = ?, role = ?, phone = ? WHERE id = ?";
        await db.query(query, [email, username, role, phone, id]);
        res.json({ message: "User updated successfully" });
    } catch (err) {
        console.error("Error updating user:", err);
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
