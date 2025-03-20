const db = require('../config/db');

const { sendEmail } = require('../utils/EmailService'); 



exports.createRequest = async (req, res) => {
    const { user_id, site_id, reason, requested_time } = req.body;

    try {
        // Check if the user has an existing request for this site, excluding returned ones
        const [duplicateRequest] = await db.query(
            "SELECT * FROM key_requests WHERE user_id = ? AND site_id = ? AND status != 'Returned'",
            [user_id, site_id]
        );

        if (duplicateRequest.length > 0) {
            return res.status(400).json({ error: "You have an active request for this site. You can only request another key once it has been returned." });
        }

        // Check if the site is active
        const [siteStatus] = await db.query("SELECT status FROM sites WHERE id = ?", [site_id]);
        if (siteStatus.length === 0) {
            return res.status(404).json({ error: "Site not found." });
        } else if (siteStatus[0].status.toLowerCase() !== 'active') {
            return res.status(400).json({ error: "Key requests are only allowed for active sites." });
        }

        // Check if there's any active or pending request for this site in outsider requests
        const [existingOutsiderRequests] = await db.query(
            "SELECT * FROM outsider_requests WHERE site_id = ? AND status IN ('Approved', 'Pending', 'In Process')",
            [site_id]
        );

        if (existingOutsiderRequests.length > 0) {
            return res.status(400).json({ error: "A key request for this site is already in progress by another user." });
        }

        // Check if there's any non-returned request for this site in key_requests
        const [existingKeyRequests] = await db.query(
            "SELECT * FROM key_requests WHERE site_id = ? AND status IN ('Approved', 'Pending', 'In Process')",
            [site_id]
        );

        if (existingKeyRequests.length > 0) {
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

        const createEmailWrapper = (content) => `
        <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: auto; padding: 0; background-color: #ffffff;">
            <!-- Header with logo -->
            <div style="background-color: #CC3D35; padding: 20px; text-align: center;">
                <img src="https://pbs.twimg.com/profile_images/973500459284561920/9a_JIgzc_400x400.jpg" 
                     alt="Company Logo" 
                     style="width: 120px; height: auto;"
                />
            </div>
            
            <!-- Main content -->
            <div style="padding: 40px 30px; background-color: #ffffff;">
                ${content}
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f7f7f7; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="color: #666666; font-size: 12px; margin: 0;">
                    © 2024 Security Access Team. All rights reserved.
                </p>
                <p style="color: #666666; font-size: 12px; margin: 10px 0 0 0;">
                    This is an automated message, please do not reply directly to this email.
                </p>
            </div>
        </div>
    `;

    // Button style
    const buttonStyle = `
        display: inline-block;
        padding: 12px 24px;
        background-color: #CC3D35;
        color: #ffffff;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
        margin: 20px 0;
    `;

    // Status badge style
    const getStatusBadge = (status, color) => `
        display: inline-block;
        padding: 6px 12px;
        background-color: ${color};
        color: #ffffff;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
    `;

    switch (status) {
        case 'Approved':
            emailSubject = "✅ Key Request Approved - Action Required";
            emailHtml = createEmailWrapper(`
                <h1 style="color: #CC3D35; margin: 0 0 30px 0; font-size: 24px;">Key Request Approved</h1>
                <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear ${request.username},</p>
                
                <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    Your request for access to <strong>${request.site_name}</strong> has been 
                    <span style="${getStatusBadge('Approved', '#4CAF50')}">Approved</span>
                </p>

                <div style="background-color: #f8f9fa; border-left: 4px solid #CC3D35; padding: 20px; margin: 30px 0;">
                    <h3 style="color: #CC3D35; margin: 0 0 15px 0;">Important Information</h3>
                    <ul style="color: #333333; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 10px;">Request ID: <strong>${request.id}</strong></li>
                        <li style="margin-bottom: 10px;">Site: <strong>${request.site_name}</strong></li>
                        <li style="margin-bottom: 10px;">Return Deadline: <strong>Within 24 hours</strong></li>
                    </ul>
                </div>

                <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    ⚠️ <strong>Important:</strong> Please ensure to return the key within 24 hours of this approval.
                </p>

                <a href="#" style="${buttonStyle}">Access Site Details in the system</a>

                <p style="color: #666666; font-size: 14px; margin-top: 40px;">
                    Best Regards,<br>
                    Security Access Team
                </p>
            `);
            break;

        case 'Denied':
            emailSubject = "❌ Key Request Status Update";
            emailHtml = createEmailWrapper(`
                <h1 style="color: #CC3D35; margin: 0 0 30px 0; font-size: 24px;">Key Request Update</h1>
                <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear ${request.username},</p>
                
                <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    We regret to inform you that your request for access to <strong>${request.site_name}</strong> has been 
                    <span style="${getStatusBadge('Denied', '#ff4c4c')}">Denied</span>
                </p>

                <div style="background-color: #f8f9fa; border-left: 4px solid #CC3D35; padding: 20px; margin: 30px 0;">
                    <h3 style="color: #CC3D35; margin: 0 0 15px 0;">Request Details</h3>
                    <ul style="color: #333333; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 10px;">Request ID: <strong>${request.id}</strong></li>
                        <li style="margin-bottom: 10px;">Site: <strong>${request.site_name}</strong></li>
                    </ul>
                </div>

                <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    If you believe this decision was made in error or need further clarification, please contact our support team.
                </p>

                <a href="#" style="${buttonStyle}">Contact Support</a>

                <p style="color: #666666; font-size: 14px; margin-top: 40px;">
                    Best Regards,<br>
                    Security Access Team
                </p>
            `);
            break;

        case 'Returned':
            emailSubject = "🔑 Key Return Confirmation";
            emailHtml = createEmailWrapper(`
                <h1 style="color: #CC3D35; margin: 0 0 30px 0; font-size: 24px;">Key Return Confirmation</h1>
                <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear ${request.username},</p>
                
                <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    We confirm that the key for <strong>${request.site_name}</strong> has been 
                    <span style="${getStatusBadge('Returned', '#FFA500')}">Successfully Returned</span>
                </p>

                <div style="background-color: #f8f9fa; border-left: 4px solid #CC3D35; padding: 20px; margin: 30px 0;">
                    <h3 style="color: #CC3D35; margin: 0 0 15px 0;">Return Details</h3>
                    <ul style="color: #333333; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 10px;">Request ID: <strong>${request.id}</strong></li>
                        <li style="margin-bottom: 10px;">Site: <strong>${request.site_name}</strong></li>
                        <li style="margin-bottom: 10px;">Status: <strong>Returned</strong></li>
                    </ul>
                </div>

                <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    Thank you for following our key return policy. Your cooperation helps maintain our security standards.
                </p>

                <a href="#" style="${buttonStyle}">View History in the system</a>

                <p style="color: #666666; font-size: 14px; margin-top: 40px;">
                    Best Regards,<br>
                    Security Access Team
                </p>
            `);
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
exports.deleteRequest = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("DELETE FROM key_requests WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Site not found" });
        }

        res.status(200).json({ message: "Site deleted successfully" });
    } catch (error) {
        console.error("Error deleting site:", error);
        res.status(500).json({ error: error.message });
    }
};
