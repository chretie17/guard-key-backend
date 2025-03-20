const db = require('../config/db');

// Create a new site
exports.createSite = async (req, res) => {
    const { name, location, status } = req.body;
    try {
        const [result] = await db.query("INSERT INTO sites (name, location, status) VALUES (?, ?, ?)", [name, location, status]);
        res.status(201).json({ id: result.insertId, name, location, status });
    } catch (error) {
        res.status(500).json({ error: 'Error creating site' });
    }
};

// Get all sites
exports.getAllSites = async (req, res) => {
    try {
        const [sites] = await db.query("SELECT * FROM sites");
        res.json(sites);
    } catch (error) {
        res.status(500).json({ error: 'Error retrieving sites' });
    }
};

// Update a site
exports.updateSite = async (req, res) => {
    const { id } = req.params;
    const { name, location, status } = req.body;
    try {
        await db.query("UPDATE sites SET name = ?, location = ?, status = ? WHERE id = ?", [name, location, status, id]);
        res.json({ id, name, location, status });
    } catch (error) {
        res.status(500).json({ error: 'Error updating site' });
    }
};

// Delete a site
exports.deleteSite = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("DELETE FROM sites WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Site not found" });
        }

        res.status(200).json({ message: "Site deleted successfully" });
    } catch (error) {
        console.error("Error deleting site:", error);
        res.status(500).json({ error: error.message });
    }
};
