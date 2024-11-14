const db = require('../config/db');

// Create a new key request
exports.createRequest = async (req, res) => {
    const { user_id, site_id, reason, requested_time } = req.body;

    try {
        // Check if there's any non-returned request for this site
        const [existingRequests] = await db.query(
            "SELECT * FROM key_requests WHERE site_id = ? AND status IN ('Approved', 'Pending', 'In Process')",
            [site_id]
        );

        if (existingRequests.length > 0) {
            return res.status(400).json({ error: "A key request for this site is already in progress or approved." });
        }

        // Insert the new request
        const query = "INSERT INTO key_requests (user_id, site_id, reason, requested_time) VALUES (?, ?, ?, ?)";
        await db.query(query, [user_id, site_id, reason, requested_time]);
        res.status(201).json({ message: "Key request submitted successfully" });
    } catch (error) {
        console.error("Error creating key request:", error);
        res.status(500).json({ error: "Error creating key request" });
    }
};

// Get all requests for a specific user (with username and site name)
exports.getUserRequests = async (req, res) => {
    const { userId } = req.params;
    try {
        const query = `
            SELECT kr.id, s.name AS site_name, kr.request_date, kr.status, kr.reason, kr.requested_time
            FROM key_requests kr
            JOIN sites s ON kr.site_id = s.id
            WHERE kr.user_id = ?
            ORDER BY kr.request_date DESC
        `;
        const [results] = await db.query(query, [userId]);
        res.json(results);
    } catch (error) {
        console.error("Error fetching user requests:", error);
        res.status(500).json({ error: "Error fetching user requests" });
    }
};


// Get all key requests for admin (with username and site name)
exports.getAllRequests = async (req, res) => {
    try {
        const query = `
            SELECT kr.id, kr.user_id, u.username, kr.site_id, s.name AS site_name, 
                   kr.request_date, kr.status, kr.reason, kr.requested_time
            FROM key_requests kr
            JOIN users u ON kr.user_id = u.id
            JOIN sites s ON kr.site_id = s.id
            ORDER BY kr.request_date DESC
        `;
        const [results] = await db.query(query);
        res.json(results);
    } catch (error) {
        console.error("Error fetching all key requests:", error);
        res.status(500).json({ error: "Error fetching all key requests" });
    }
};


// Update request status for a specific key request
exports.updateRequestStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['Approved', 'Denied', 'Returned'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Valid statuses are: Approved, Denied, Returned" });
    }

    try {
        const query = "UPDATE key_requests SET status = ? WHERE id = ?";
        const [result] = await db.query(query, [status, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Request not found" });
        }

        res.json({ message: "Request status updated successfully" });
    } catch (error) {
        console.error("Error updating request status:", error);
        res.status(500).json({ error: "Error updating request status" });
    }
};
