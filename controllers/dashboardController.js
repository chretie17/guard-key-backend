const db = require('../config/db');

// Fetch total number of requests
exports.getTotalRequests = async (req, res) => {
    try {
        const [results] = await db.query("SELECT COUNT(*) AS total_requests FROM key_requests");
        res.json(results[0]);
    } catch (error) {
        console.error("Error fetching total requests:", error);
        res.status(500).json({ error: "Error fetching total requests" });
    }
};

// Fetch total approved requests
exports.getApprovedRequests = async (req, res) => {
    try {
        const [results] = await db.query("SELECT COUNT(*) AS approved_requests FROM key_requests WHERE status = 'Approved'");
        res.json(results[0]);
    } catch (error) {
        console.error("Error fetching approved requests:", error);
        res.status(500).json({ error: "Error fetching approved requests" });
    }
};

// Fetch best performing site
exports.getBestPerformingSite = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT s.id AS site_id, s.name AS site_name, COUNT(kr.id) AS total_requests
            FROM sites s
            LEFT JOIN key_requests kr ON s.id = kr.site_id
            GROUP BY s.id, s.name
            ORDER BY total_requests DESC
            LIMIT 1
        `);
        res.json(results[0]);
    } catch (error) {
        console.error("Error fetching best performing site:", error);
        res.status(500).json({ error: "Error fetching best performing site" });
    }
};

// Fetch most active user
exports.getMostActiveUser = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT u.id AS user_id, u.username, COUNT(kr.id) AS total_requests
            FROM users u
            JOIN key_requests kr ON u.id = kr.user_id
            GROUP BY u.id, u.username
            ORDER BY total_requests DESC
            LIMIT 1
        `);
        res.json(results[0]);
    } catch (error) {
        console.error("Error fetching most active user:", error);
        res.status(500).json({ error: "Error fetching most active user" });
    }
};

// Fetch request distribution by site
exports.getRequestDistributionBySite = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT s.name AS site_name, COUNT(kr.id) AS total_requests
            FROM sites s
            LEFT JOIN key_requests kr ON s.id = kr.site_id
            GROUP BY s.id, s.name
            ORDER BY total_requests DESC
        `);
        res.json(results);
    } catch (error) {
        console.error("Error fetching request distribution by site:", error);
        res.status(500).json({ error: "Error fetching request distribution by site" });
    }
};

// Fetch request status breakdown
exports.getRequestStatusBreakdown = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT status, COUNT(*) AS total_requests
            FROM key_requests
            GROUP BY status
        `);
        res.json(results);
    } catch (error) {
        console.error("Error fetching request status breakdown:", error);
        res.status(500).json({ error: "Error fetching request status breakdown" });
    }
};

// Fetch most popular request time
exports.getMostPopularRequestTime = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT HOUR(requested_time) AS request_hour, COUNT(*) AS total_requests
            FROM key_requests
            GROUP BY HOUR(requested_time)
            ORDER BY total_requests DESC
            LIMIT 1
        `);
        res.json(results[0]);
    } catch (error) {
        console.error("Error fetching most popular request time:", error);
        res.status(500).json({ error: "Error fetching most popular request time" });
    }
};


exports.getRequestTrendsOverTime = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT 
                DATE(request_date) AS request_date, 
                COUNT(*) AS total_requests
            FROM 
                key_requests
            GROUP BY 
                DATE(request_date)
            ORDER BY 
                request_date ASC
        `);

        // Format dates in JavaScript
        const formattedResults = results.map(row => ({
            ...row,
            request_date: new Date(row.request_date).toISOString().split('T')[0] // Format as YYYY-MM-DD
        }));

        res.json(formattedResults);
    } catch (error) {
        console.error("Error fetching request trends over time:", error);
        res.status(500).json({ error: "Error fetching request trends over time" });
    }
};
