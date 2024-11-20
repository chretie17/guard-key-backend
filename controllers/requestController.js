const db = require('../config/db');
const { sendEmail } = require('../utils/emailService');

// Fetch all active sites for the public form
exports.getActiveSites = async (req, res) => {
    try {
        const [sites] = await db.query("SELECT id, name FROM sites WHERE status = 'active'");
        res.json(sites);
    } catch (error) {
        console.error("Error fetching active sites:", error);
        res.status(500).json({ error: "Error fetching active sites" });
    }
};

// Create a new outsider key request
exports.createOutsiderRequest = async (req, res) => {
    const { name, email, phone, site_id, reason, requested_time, partner_name } = req.body;

    if (!partner_name) {
        return res.status(400).json({ error: "Partner name is required." });
    }

    try {
        // Check if the site is active
        const [siteStatus] = await db.query("SELECT status FROM sites WHERE id = ?", [site_id]);
        if (siteStatus.length === 0 || siteStatus[0].status.toLowerCase() !== 'active') {
            return res.status(400).json({ error: "Key requests are only allowed for active sites." });
        }

        // Check if there's an active or pending key request for this site
        const [existingRequests] = await db.query(`
            SELECT id, name, email
            FROM outsider_requests
            WHERE site_id = ? AND status IN ('Approved', 'Pending', 'In Process')
            LIMIT 1
        `, [site_id]);

        if (existingRequests.length > 0) {
            return res.status(400).json({
                error: `A key request for this site is already in progress by ${existingRequests[0].name}.`
            });
        }

        // Insert the new outsider request
        const query = `
            INSERT INTO outsider_requests (name, email, phone, site_id, reason, requested_time, status, partner_name)
            VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
        `;
        await db.query(query, [name, email, phone, site_id, reason, requested_time, partner_name]);

        // Send confirmation email
        const emailSubject = "Key Request Submitted Successfully";
        const emailHtml = `
            <p>Dear ${name},</p>
            <p>Your request for a key to access <strong>${partner_name}</strong> on behalf of our site has been successfully submitted and is awaiting review.</p>
            <p>Requested Time: ${requested_time}</p>
            <p>Reason: ${reason}</p>
            <p>Thank you.</p>
        `;
        await sendEmail(email, emailSubject, emailHtml);

        res.status(201).json({ message: "Outsider key request submitted successfully" });
    } catch (error) {
        console.error("Error creating outsider key request:", error);
        res.status(500).json({ error: "Error creating outsider key request" });
    }
};

// Fetch all outsider requests
exports.getAllOutsiderRequests = async (req, res) => {
    try {
        const query = `
            SELECT o.id, o.name, o.email, o.phone, o.reason, o.requested_time, o.status, 
                   s.name AS site_name, s.location, o.partner_name
            FROM outsider_requests o
            JOIN sites s ON o.site_id = s.id
            ORDER BY o.requested_time DESC
        `;
        const [results] = await db.query(query);
        res.json(results);
    } catch (error) {
        console.error("Error fetching outsider requests:", error);
        res.status(500).json({ error: "Error fetching outsider requests" });
    }
};

// Admin function to update outsider request status
exports.updateOutsiderRequestStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Approved', 'Denied', 'Returned'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Valid statuses are: Approved, Denied, Returned" });
    }

    try {
        // Retrieve request details for email notification
        const query = `
            SELECT o.id, o.name, o.email, o.phone, o.reason, o.requested_time, o.status, 
                   s.name AS site_name, s.location, o.partner_name
            FROM outsider_requests o
            JOIN sites s ON o.site_id = s.id
            WHERE o.id = ?
        `;
        const [results] = await db.query(query, [id]);

        if (results.length === 0) {
            return res.status(404).json({ error: "Request not found" });
        }

        const request = results[0];

        // Update the request status
        const updateQuery = "UPDATE outsider_requests SET status = ? WHERE id = ?";
        await db.query(updateQuery, [status, id]);

        // Prepare email content
        let emailSubject;
        let emailHtml;

        switch (status) {
            case 'Approved':
                emailSubject = "Key Request Approved";
                emailHtml = `
                    <p>Dear ${request.name},</p>
                    <p>Your request for access to <strong>${request.site_name}</strong> (${request.location}), initiated by <strong>${request.partner_name}</strong>, has been approved.</p>
                    <p>Please return the key within 24 hours.</p>
                `;
                break;
            case 'Denied':
                emailSubject = "Key Request Denied";
                emailHtml = `
                    <p>Dear ${request.name},</p>
                    <p>Your request for access to <strong>${request.site_name}</strong> (${request.location}), initiated by <strong>${request.partner_name}</strong>, has been denied.</p>
                `;
                break;
            case 'Returned':
                emailSubject = "Key Returned Confirmation";
                emailHtml = `
                    <p>Dear ${request.name},</p>
                    <p>The key for accessing <strong>${request.site_name}</strong> (${request.location}), initiated by <strong>${request.partner_name}</strong>, has been successfully returned.</p>
                `;
                break;
        }

        // Send notification email
        await sendEmail(request.email, emailSubject, emailHtml);

        res.json({ message: "Request status updated and email notification sent successfully." });
    } catch (error) {
        console.error("Error updating outsider request status:", error);
        res.status(500).json({ error: "Error updating request status." });
    }
};
