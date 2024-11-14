const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Login using either username or email
exports.login = async (req, res) => {
    const { identifier, password } = req.body; // Identifier can be either username or email

    try {
        const [results] = await db.query("SELECT * FROM users WHERE email = ? OR username = ?", [identifier, identifier]);
        if (results.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user.id, role: user.role }, '7877a132155b51a6aedb7150eb50cca1908e943f6d6d7702b83a5f6f62e5ea69', { expiresIn: '12h' });

        // Send token, role, and user id in response
        res.json({ token, role: user.role, userId: user.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error during login process" });
    }
};
