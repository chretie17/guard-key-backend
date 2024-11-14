const db = require('../config/db');

const { sendEmail } = require('../utils/EmailService'); 



exports.createRequest = async (req, res) => {
    const { user_id, site_id, reason, requested_time } = req.body;

    try {
        // Check if the user already has a request for this site, regardless of status
        const [duplicateRequest] = await db.query(
            "SELECT * FROM key_requests WHERE user_id = ? AND site_id = ?",
            [user_id, site_id]
        );

        if (duplicateRequest.length > 0) {
            return res.status(400).json({ error: "You have already submitted a request for this site." });
        }

        // Check if the site is active
        const [siteStatus] = await db.query("SELECT status FROM sites WHERE id = ?", [site_id]);
        if (siteStatus.length === 0) {
            return res.status(404).json({ error: "Site not found." });
        } else if (siteStatus[0].status !== 'active') {
            return res.status(400).json({ error: "Key requests are only allowed for active sites." });
        }

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
        // Retrieve request details to get user information and site name
        const query = `
            SELECT kr.id, kr.user_id, u.email, u.username, kr.site_id, s.name AS site_name
            FROM key_requests kr
            JOIN users u ON kr.user_id = u.id
            JOIN sites s ON kr.site_id = s.id
            WHERE kr.id = ?
        `;
        const [results] = await db.query(query, [id]);

        if (results.length === 0) {
            return res.status(404).json({ error: "Request not found" });
        }

        const request = results[0];

        // Update the request status and set approved_date if the status is "Approved"
        let updateQuery = "UPDATE key_requests SET status = ?";
        const queryParams = [status];

        if (status === 'Approved') {
            updateQuery += ", approved_date = NOW()";
        }
        
        updateQuery += " WHERE id = ?";
        queryParams.push(id);

        const [updateResult] = await db.query(updateQuery, queryParams);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: "Request update failed" });
        }

        // Email content based on status
        let emailSubject;
        let emailHtml;

        switch (status) {
            case 'Approved':
                emailSubject = "Your Key Request Has Been Approved";
                emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #4CAF50; text-align: center;">Key Request Approved</h2>
                        <p>Dear ${request.username},</p>
                        <p>Your request for the key to access the site <strong>${request.site_name}</strong> has been <span style="color: #4CAF50; font-weight: bold;">approved</span>.</p>
                        <p><strong>Please remember to return the key within 24 hours of this approval.</strong></p>
                        <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Site Name:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${request.site_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Request ID:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${request.id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Approval Status:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd; color: #4CAF50;">Approved</td>
                            </tr>
                        </table>
                        <p>You may now proceed to access the site as scheduled. Please be aware that you are required to return the key within the next 24 hours. Failure to do so may result in reminders and potential action as per our policy.</p>
                        <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
                    </div>
                `;
                break;

            case 'Denied':
                emailSubject = "Your Key Request Has Been Denied";
                emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #ff4c4c; text-align: center;">Key Request Denied</h2>
                        <p>Dear ${request.username},</p>
                        <p>Unfortunately, your request for the key to access the site <strong>${request.site_name}</strong> has been <span style="color: #ff4c4c; font-weight: bold;">denied</span>.</p>
                        <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Site Name:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${request.site_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Request ID:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${request.id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Status:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd; color: #ff4c4c;">Denied</td>
                            </tr>
                        </table>
                        <p>If you have questions, please contact support.</p>
                        <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
                    </div>
                `;
                break;

            case 'Returned':
                emailSubject = "Key Successfully Returned";
                emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #FFA500; text-align: center;">Key Returned Successfully</h2>
                        <p>Dear ${request.username},</p>
                        <p>This is to confirm that the key for accessing the site <strong>${request.site_name}</strong> has been <span style="color: #FFA500; font-weight: bold;">successfully returned</span>.</p>
                        <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Site Name:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${request.site_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Request ID:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${request.id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Status:</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd; color: #FFA500;">Returned</td>
                            </tr>
                        </table>
                        <p>Thank you for using our services.</p>
                        <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
                    </div>
                `;
                break;
        }

        try {
            await sendEmail(request.email, emailSubject, emailHtml);
            console.log(`Status update email (${status}) sent to:`, request.email);
        } catch (emailError) {
            console.error("Error sending status update email:", emailError);
        }

        res.json({ message: "Request status updated and email sent successfully" });
    } catch (error) {
        console.error("Error updating request status:", error);
        res.status(500).json({ error: "Error updating request status" });
    }
};
