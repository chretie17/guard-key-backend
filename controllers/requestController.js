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
    const { name, email, phone, site_id, reason, requested_time } = req.body;

    try {
        // Check if the site is active
        const [siteStatus] = await db.query("SELECT status FROM sites WHERE id = ?", [site_id]);
        if (siteStatus.length === 0 || siteStatus[0].status.toLowerCase() !== 'active') {
            return res.status(400).json({ error: "Key requests are only allowed for active sites." });
        }

        // Check if there's an active key request for this site and retrieve the user who requested it
        const [existingKeyRequests] = await db.query(`
            SELECT kr.id, u.username, u.email
            FROM key_requests kr
            JOIN users u ON kr.user_id = u.id
            WHERE kr.site_id = ? AND kr.status IN ('Approved', 'Pending', 'In Process')
            LIMIT 1
        `, [site_id]);

        // If an existing request is found, respond with a message including user info
        if (existingKeyRequests.length > 0) {
            const activeRequest = existingKeyRequests[0];
            return res.status(400).json({
                error: `A key request for this site is already in progress or approved by ${activeRequest.username || activeRequest.email}.`
            });
        }

        // Insert the new outsider request
        const query = `
            INSERT INTO outsider_requests (name, email, phone, site_id, reason, requested_time, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        `;
        await db.query(query, [name, email, phone, site_id, reason, requested_time]);

        // Send confirmation email to the outsider
        const emailSubject = "Key Request Submitted Successfully";
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
                <h2 style="color: #333; text-align: center;">Key Request Submitted</h2>
                <p>Dear ${name},</p>
                <p>Your request for a key to access the site has been successfully submitted and is awaiting review.</p>
                <p><strong>Request Details:</strong></p>
                <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Requested Access Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${requested_time}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${reason}</td></tr>
                </table>
                <p>You will receive an update on the status of your request shortly.</p>
                <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
            </div>
        `;
        
        await sendEmail(email, emailSubject, emailHtml);
        res.status(201).json({ message: "Outsider key request submitted successfully" });

    } catch (error) {
        console.error("Error creating outsider key request:", error);
        res.status(500).json({ error: "Error creating outsider key request" });
    }
};


exports.getAllOutsiderRequests = async (req, res) => {
    try {
        const query = `
            SELECT o.id, o.name, o.email, o.phone, o.reason, o.requested_time, o.status, s.name AS site_name
            FROM outsider_requests o
            JOIN sites s ON o.site_id = s.id
            ORDER BY o.request_date DESC
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
        // Retrieve request details for sending email
        const query = `
            SELECT or.id, or.name, or.email, or.reason, or.requested_time, s.name AS site_name
            FROM outsider_requests or
            JOIN sites s ON or.site_id = s.id
            WHERE or.id = ?
        `;
        const [results] = await db.query(query, [id]);

        if (results.length === 0) {
            return res.status(404).json({ error: "Request not found" });
        }

        const request = results[0];

        // Update request status
        const updateQuery = "UPDATE outsider_requests SET status = ? WHERE id = ?";
        const [updateResult] = await db.query(updateQuery, [status, id]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: "Failed to update request" });
        }

        // Prepare email content based on status
        let emailSubject = "";
        let emailHtml = "";

        switch (status) {
            case 'Approved':
                emailSubject = "Your Key Request Has Been Approved";
                emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
                        <h2 style="color: #4CAF50; text-align: center;">Key Request Approved</h2>
                        <p>Dear ${request.name},</p>
                        <p>Your request for the key to access <strong>${request.site_name}</strong> has been approved.</p>
                        <p><strong>Please remember to return the key within 24 hours after collecting it.</strong></p>
                        <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
                    </div>
                `;
                break;
            case 'Denied':
                emailSubject = "Your Key Request Has Been Denied";
                emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
                        <h2 style="color: #ff4c4c; text-align: center;">Key Request Denied</h2>
                        <p>Dear ${request.name},</p>
                        <p>Unfortunately, your request to access <strong>${request.site_name}</strong> has been denied.</p>
                        <p>If you believe this is an error, please contact the security team.</p>
                        <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
                    </div>
                `;
                break;
            case 'Returned':
                emailSubject = "Key Returned Confirmation";
                emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
                        <h2 style="color: #E13A44; text-align: center;">Key Returned Confirmation</h2>
                        <p>Dear ${request.name},</p>
                        <p>Your key return for <strong>${request.site_name}</strong> has been confirmed. Thank you for your cooperation.</p>
                        <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
                    </div>
                `;
                break;
        }

        // Send the email notification
        try {
            await sendEmail(request.email, emailSubject, emailHtml);
            console.log("Notification email sent to:", request.email);
        } catch (emailError) {
            console.error("Error sending notification email:", emailError);
        }

        res.json({ message: "Request status updated and notification sent successfully" });
    } catch (error) {
        console.error("Error updating outsider request status:", error);
        res.status(500).json({ error: "Error updating request status" });
    }
};