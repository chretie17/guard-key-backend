const db = require('../config/db');

exports.getReport = async (req, res) => {
    const { startDate, endDate } = req.query;

    // Adjust startDate and endDate to cover the full day range
    const adjustedStartDate = startDate ? `${startDate.split(' ')[0]} 00:00:00` : null;
    const adjustedEndDate = endDate ? `${endDate.split(' ')[0]} 23:59:59` : null;

    const dateFilter = adjustedStartDate && adjustedEndDate
        ? `WHERE requested_time BETWEEN ? AND ?`
        : ``;
    const dateParams = adjustedStartDate && adjustedEndDate ? [adjustedStartDate, adjustedEndDate] : [];

    try {
        console.log("Date Filter Params:", dateParams); // Debugging logs

        // Total number of requests (combining insiders and outsiders)
        const [totalRequestsResult] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM outsider_requests ${dateFilter}) +
                (SELECT COUNT(*) FROM key_requests ${dateFilter}) AS total_requests
        `, [...dateParams, ...dateParams]);
        const totalRequests = totalRequestsResult[0]?.total_requests || 0;

        // Total approved requests (combining insiders and outsiders)
        const [approvedRequestsResult] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM outsider_requests WHERE status = 'Approved' ${dateFilter ? `AND requested_time BETWEEN ? AND ?` : ''}) +
                (SELECT COUNT(*) FROM key_requests WHERE status = 'Approved' ${dateFilter ? `AND requested_time BETWEEN ? AND ?` : ''}) AS approved_requests
        `, [...dateParams, ...dateParams]);
        const approvedRequests = approvedRequestsResult[0]?.approved_requests || 0;

        // Best-performing site
        const [bestPerformingSiteResult] = await db.query(`
            SELECT 
                s.name AS site_name, 
                (COUNT(o.id) + COUNT(kr.id)) AS total_requests
            FROM sites s
            LEFT JOIN outsider_requests o ON s.id = o.site_id ${dateFilter ? `AND o.requested_time BETWEEN ? AND ?` : ''}
            LEFT JOIN key_requests kr ON s.id = kr.site_id ${dateFilter ? `AND kr.requested_time BETWEEN ? AND ?` : ''}
            GROUP BY s.id, s.name
            ORDER BY total_requests DESC
            LIMIT 1
        `, [...dateParams, ...dateParams]);
        const bestPerformingSite = bestPerformingSiteResult[0] || { site_name: 'No data', total_requests: 0 };

        // Best-performing partner (for outsiders only)
        const [bestPartnerResult] = await db.query(`
            SELECT 
                o.partner_name, 
                COUNT(o.id) AS total_requests 
            FROM outsider_requests o
            WHERE o.partner_name IS NOT NULL 
            ${dateFilter ? `AND o.requested_time BETWEEN ? AND ?` : ''}
            GROUP BY o.partner_name
            ORDER BY total_requests DESC
            LIMIT 1
        `, dateParams);
        const bestPartner = bestPartnerResult[0] || { partner_name: 'No data', total_requests: 0 };

        // Request distribution by site
        const [requestDistributionResult] = await db.query(`
            SELECT 
                s.name AS site_name, 
                (COUNT(o.id) + COUNT(kr.id)) AS total_requests
            FROM sites s
            LEFT JOIN outsider_requests o ON s.id = o.site_id ${dateFilter ? `AND o.requested_time BETWEEN ? AND ?` : ''}
            LEFT JOIN key_requests kr ON s.id = kr.site_id ${dateFilter ? `AND kr.requested_time BETWEEN ? AND ?` : ''}
            GROUP BY s.id, s.name
            ORDER BY total_requests DESC
        `, [...dateParams, ...dateParams]);

        // Request status breakdown
        const [statusBreakdownResult] = await db.query(`
            SELECT status, COUNT(*) AS total_requests FROM (
                SELECT 'Outsider' AS user_type, status FROM outsider_requests ${dateFilter}
                UNION ALL
                SELECT 'Insider' AS user_type, status FROM key_requests ${dateFilter}
            ) AS combined_requests
            GROUP BY status
        `, [...dateParams, ...dateParams]);

        // User details with differentiation between insiders and outsiders
        const [userDetailsResult] = await db.query(`
            SELECT 
                o.id AS request_id,
                o.name AS requester_name,
                o.email AS requester_email,
                o.phone AS requester_phone,
                s.name AS site_name,
                o.partner_name,
                o.status,
                'Outsider' AS user_type,
                o.requested_time
            FROM outsider_requests o
            JOIN sites s ON o.site_id = s.id
            ${dateFilter}
            UNION ALL
            SELECT 
                kr.id AS request_id,
                u.username AS requester_name,
                u.email AS requester_email,
                NULL AS requester_phone,
                s.name AS site_name,
                NULL AS partner_name,
                kr.status,
                'Insider' AS user_type,
                kr.requested_time
            FROM key_requests kr
            JOIN users u ON kr.user_id = u.id
            JOIN sites s ON kr.site_id = s.id
            ${dateFilter}
            ORDER BY requested_time DESC
        `, [...dateParams, ...dateParams]);

        // Response JSON
        res.json({
            dateRange: {
                startDate: adjustedStartDate || 'All-time',
                endDate: adjustedEndDate || 'All-time',
            },
            totalRequests,
            approvedRequests,
            bestPerformingSite,
            bestPartner,
            requestDistribution: requestDistributionResult,
            statusBreakdown: statusBreakdownResult,
            userDetails: userDetailsResult.map(user => ({
                ...user,
                user_type: user.user_type === 'Outsider' ? 'Outsider' : 'Insider',
            })),
        });
    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ error: "Error generating report" });
    }
};
