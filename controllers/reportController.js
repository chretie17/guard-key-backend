const db = require('../config/db');

exports.getReport = async (req, res) => {
    const { startDate, endDate, status, userType, site_id, partner_name } = req.query;

    try {
        let filters = [];
        let params = [];

        // **Date Range Filtering**
        if (startDate && endDate) {
            filters.push("requested_time BETWEEN ? AND ?");
            params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        // **Status Filtering**
        if (status) {
            filters.push("status = ?");
            params.push(status);
        }

        // **User Type Filtering**
        if (userType === "KTRN Employees") {
            filters.push("user_id IS NOT NULL");
        } else if (userType === "Partners") {
            filters.push("user_id IS NULL");
        }

        // **Site Filtering**
        if (site_id) {
            filters.push("site_id = ?");
            params.push(site_id);
        }

        // **Partner Name Filtering (Only for Outsiders)**
        if (partner_name) {
            filters.push("partner_name = ?");
            params.push(partner_name);
        }

        // **Building WHERE Clause**
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

        // **Fetching Total Requests**
        const [totalRequestsResult] = await db.query(`
            SELECT COUNT(*) AS total_requests FROM (
                SELECT id FROM outsider_requests ${whereClause}
                UNION ALL
                SELECT id FROM key_requests ${whereClause}
            ) AS combined_requests
        `, [...params, ...params]);

        const totalRequests = totalRequestsResult[0]?.total_requests || 0;

        // **Fetching Approved Requests**
        const [approvedRequestsResult] = await db.query(`
            SELECT COUNT(*) AS approved_requests FROM (
                SELECT id FROM outsider_requests WHERE status = 'Approved' ${filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""}
                UNION ALL
                SELECT id FROM key_requests WHERE status = 'Approved' ${filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""}
            ) AS approved_requests
        `, [...params, ...params]);

        const approvedRequests = approvedRequestsResult[0]?.approved_requests || 0;

        // **Fetching Best Performing Site**
        const [bestPerformingSiteResult] = await db.query(`
            SELECT s.name AS site_name, COUNT(*) AS total_requests
            FROM (
                SELECT site_id FROM outsider_requests ${whereClause}
                UNION ALL
                SELECT site_id FROM key_requests ${whereClause}
            ) AS requests
            JOIN sites s ON s.id = requests.site_id
            GROUP BY s.id, s.name
            ORDER BY total_requests DESC
            LIMIT 1
        `, [...params, ...params]);

        const bestPerformingSite = bestPerformingSiteResult[0] || { site_name: "No Data", total_requests: 0 };

        // **Fetching Best Partner (Outsiders)**
        const [bestPartnerResult] = await db.query(`
            SELECT partner_name, COUNT(*) AS total_requests
            FROM outsider_requests
            WHERE partner_name IS NOT NULL ${whereClause ? `AND ${filters.join(" AND ")}` : ""}
            GROUP BY partner_name
            ORDER BY total_requests DESC
            LIMIT 1
        `, [...params]);

        const bestPartner = bestPartnerResult[0] || { partner_name: "No Data", total_requests: 0 };

        // **Fetching Status Breakdown**
        const [statusBreakdownResult] = await db.query(`
            SELECT status, COUNT(*) AS total_requests FROM (
                SELECT status FROM outsider_requests ${whereClause}
                UNION ALL
                SELECT status FROM key_requests ${whereClause}
            ) AS combined_requests
            GROUP BY status
            ORDER BY total_requests DESC
        `, [...params, ...params]);

        // **Fetching Request Distribution by Site**
        const [requestDistributionResult] = await db.query(`
            SELECT s.name AS site_name, COUNT(*) AS total_requests
            FROM (
                SELECT site_id FROM outsider_requests ${whereClause}
                UNION ALL
                SELECT site_id FROM key_requests ${whereClause}
            ) AS requests
            JOIN sites s ON s.id = requests.site_id
            GROUP BY s.id, s.name
            ORDER BY total_requests DESC
        `, [...params, ...params]);

        // **Fetching Users Who Requested Keys**
        const [userDetailsResult] = await db.query(`
           SELECT o.id AS request_id, o.name AS requester_name, o.email AS requester_email, 
           o.phone AS requester_phone, s.name AS site_name, 
           o.partner_name, o.status, 'Partners' AS user_type, o.requested_time
    FROM outsider_requests o
    LEFT JOIN sites s ON o.site_id = s.id
    ${whereClause.replace(/status/g, "o.status")} -- ✅ Fix ambiguity

    UNION ALL

    SELECT kr.id AS request_id, u.username AS requester_name, u.email AS requester_email, 
           u.phone AS requester_phone, s.name AS site_name, 
           NULL AS partner_name, kr.status, 'KTRN Employees' AS user_type, kr.requested_time
    FROM key_requests kr
    JOIN users u ON kr.user_id = u.id
    LEFT JOIN sites s ON kr.site_id = s.id
    ${whereClause.replace(/status/g, "kr.status")} -- ✅ Fix ambiguity


    ORDER BY requested_time DESC
        `, [...params, ...params]);

        // **Fetching Monthly Trends**
        const [monthlyTrendsResult] = await db.query(`
            SELECT DATE_FORMAT(requested_time, '%Y-%m') AS month, COUNT(*) AS total_requests
            FROM (
                SELECT requested_time FROM outsider_requests ${whereClause}
                UNION ALL
                SELECT requested_time FROM key_requests ${whereClause}
            ) AS requests
            GROUP BY month
            ORDER BY month DESC
        `, [...params, ...params]);

        // **Fetching Daily Trends**
        const [dailyTrendsResult] = await db.query(`
            SELECT DATE(requested_time) AS day, COUNT(*) AS total_requests
            FROM (
                SELECT requested_time FROM outsider_requests ${whereClause}
                UNION ALL
                SELECT requested_time FROM key_requests ${whereClause}
            ) AS requests
            GROUP BY day
            ORDER BY day DESC
        `, [...params, ...params]);

        // **Fetching Pending vs Completed Requests**
        const [pendingCompletedResult] = await db.query(`
            SELECT 
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS total_pending,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS total_approved,
                SUM(CASE WHEN status = 'Denied' THEN 1 ELSE 0 END) AS total_denied,
                SUM(CASE WHEN status = 'Returned' THEN 1 ELSE 0 END) AS total_returned
            FROM (
                SELECT status FROM outsider_requests ${whereClause}
                UNION ALL
                SELECT status FROM key_requests ${whereClause}
            ) AS all_requests
        `, [...params, ...params]);

        // **Sending the Response**
        res.json({
            filters: {
                startDate: startDate || "All-time",
                endDate: endDate || "All-time",
                status: status || "All",
                userType: userType || "All",
                site_id: site_id || "All",
                partner_name: partner_name || "All",
            },
            summary: {
                totalRequests,
                approvedRequests,
                bestPerformingSite,
                bestPartner,
            },
            statusBreakdown: statusBreakdownResult,
            requestDistribution: requestDistributionResult,
            userDetails: userDetailsResult,
            trends: {
                monthly: monthlyTrendsResult,
                daily: dailyTrendsResult,
            },
            pendingVsCompleted: pendingCompletedResult[0],
        });

    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ error: "Error generating report" });
    }
};
