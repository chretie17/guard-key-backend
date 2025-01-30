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
const generateEmailTemplate = (type, requestDetails) => {
    const baseTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${getEmailSubject(type)}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                }
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #ffffff;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    padding: 20px 0;
                    border-bottom: 2px solid #f0f0f0;
                    margin-bottom: 30px;
                    background-color: #ffffff;
                }
                .logo {
                    width: 120px;
                    height: auto;
                    margin-bottom: 20px;
                }
                .content {
                    padding: 20px;
                    background-color: #f9f9f9;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .details-box {
                    background-color: #f0f0f0;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 2px solid #f0f0f0;
                    text-align: center;
                    font-size: 12px;
                    color: #666666;
                }
                .highlight {
                    color: #0066cc;
                    font-weight: bold;
                }
                .button {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #0066cc;
                    color: #ffffff !important;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 20px 0;
                    font-weight: bold;
                }
                .button:hover {
                    background-color: #0052a3;
                }
                .warning {
                    color: #cc0000;
                    font-weight: bold;
                }
                ul {
                    padding-left: 20px;
                }
                li {
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <img src="https://pbs.twimg.com/profile_images/973500459284561920/9a_JIgzc_400x400.jpg" 
                         alt="Company Logo" 
                         class="logo">
                    <h2 style="color: #333333; margin: 0;">${getEmailSubject(type)}</h2>
                </div>
                <div class="content">
                    ${getEmailContent(type, requestDetails)}
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply to this email.</p>
                    <p>If you need assistance, please contact your site administrator.</p>
                    <p>&copy; ${new Date().getFullYear()} KTRN. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return baseTemplate;
};

const getEmailSubject = (type) => {
    const subjects = {
        'submitted': 'Key Request Submitted Successfully',
        'approved': 'Key Request Approved',
        'denied': 'Key Request Denied',
        'returned': 'Key Returned Confirmation'
    };
    return subjects[type] || 'Key Request Update';
};

const getEmailContent = (type, request) => {
    const { name, site_name, location, partner_name, requested_time, reason } = request;
    
    const templates = {
        'submitted': `
            <p>Dear ${name},</p>
            <p>Your request for a key to access <span class="highlight">${site_name}</span> on behalf of 
               <span class="highlight">${partner_name}</span> has been successfully submitted and is awaiting review.</p>
            
            <div class="details-box">
                <p><strong>Request Details:</strong></p>
                <p><strong>Requested Time:</strong> ${requested_time}</p>
                <p><strong>Location:</strong> ${location || 'Not specified'}</p>
                <p><strong>Reason for Access:</strong> ${reason}</p>
            </div>
            
            <p>We will process your request as soon as possible and notify you of any updates.</p>
            <p>Please ensure you have reviewed all site access protocols and safety guidelines.</p>
        `,
        
        'approved': `
            <p>Dear ${name},</p>
            <p>Great news! Your request for access to <span class="highlight">${site_name}</span> 
               (${location}) has been approved.</p>
            
            <div class="details-box">
                <p><strong>Access Details:</strong></p>
                <p><strong>Site:</strong> ${site_name}</p>
                <p><strong>Location:</strong> ${location}</p>
                <p><strong>Partner:</strong> ${partner_name}</p>
            </div>
            
            <p class="warning">Important Reminders:</p>
            <ul>
                <li>Please return the key within 24 hours of receipt</li>
                <li>Follow all site safety protocols and guidelines</li>
                <li>Maintain site security at all times</li>
                <li>Report any issues or concerns immediately</li>
            </ul>
            
            <center>
                <a href="#" class="button">Contact Us for More on +250 788 830 786 </a>
            </center>
        `,
        
        'denied': `
            <p>Dear ${name},</p>
            <p>We regret to inform you that your request for access to <span class="highlight">${site_name}</span> 
               (${location}), initiated by <span class="highlight">${partner_name}</span>, has been denied.</p>
            
            <div class="details-box">
                <p><strong>Request Details:</strong></p>
                <p><strong>Requested Time:</strong> ${requested_time}</p>
                <p><strong>Location:</strong> ${location}</p>
                <p><strong>Reason Provided:</strong> ${reason}</p>
            </div>
            
            <p>If you believe this was in error or would like to submit a new request with additional information, 
               please contact us on +250 788 830 786.</p>
        `,
        
        'returned': `
            <p>Dear ${name},</p>
            <p>This email confirms that the key for accessing <span class="highlight">${site_name}</span> 
               (${location}) has been successfully returned.</p>
            
            <div class="details-box">
                <p><strong>Return Details:</strong></p>
                <p><strong>Site:</strong> ${site_name}</p>
                <p><strong>Location:</strong> ${location}</p>
                <p><strong>Partner:</strong> ${partner_name}</p>
            </div>
            
            <p>Thank you for following our key management protocols. Your cooperation helps maintain site security.</p>
        `
    };
    return templates[type] || '';
};

// Create outsider request
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

        // Check if a user already has an active key request for this site
        const [activeUserKey] = await db.query(`
            SELECT id FROM key_requests 
            WHERE site_id = ? AND status IN ('Approved', 'Pending', 'In Process') 
            LIMIT 1
        `, [site_id]);

        if (activeUserKey.length > 0) {
            return res.status(400).json({ 
                error: "A key for this site is currently in use by another user. Please wait until it is returned." 
            });
        }

        // Check if another outsider already has a pending or approved request for this site
        const [existingOutsiderRequests] = await db.query(`
            SELECT id, name FROM outsider_requests
            WHERE site_id = ? AND status IN ('Approved', 'Pending', 'In Process') 
            LIMIT 1
        `, [site_id]);

        if (existingOutsiderRequests.length > 0) {
            return res.status(400).json({
                error: `A key request for this site is already in progress by ${existingOutsiderRequests[0].name}.`
            });
        }

        // Insert the new outsider request
        const query = `
            INSERT INTO outsider_requests 
            (name, email, phone, site_id, reason, requested_time, status, partner_name)
            VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
        `;
        await db.query(query, [name, email, phone, site_id, reason, requested_time, partner_name]);

        // Send confirmation email
        const emailHtml = generateEmailTemplate('submitted', {
            name,
            site_name: partner_name,
            location: '',
            partner_name,
            requested_time,
            reason
        });

        await sendEmail(email, getEmailSubject('submitted'), emailHtml);

        res.status(201).json({ message: "Outsider key request submitted successfully" });
    } catch (error) {
        console.error("Error creating outsider key request:", error);
        res.status(500).json({ error: "Error creating outsider key request" });
    }
};

// Get all outsider requests
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

// Update outsider request status
exports.updateOutsiderRequestStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Approved', 'Denied', 'Returned'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            error: "Invalid status. Valid statuses are: Approved, Denied, Returned" 
        });
    }

    try {
        // Get request details for email
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

        // Update status
        const updateQuery = "UPDATE outsider_requests SET status = ? WHERE id = ?";
        await db.query(updateQuery, [status, id]);

        // Send notification email
        const emailType = status.toLowerCase();
        const emailHtml = generateEmailTemplate(emailType, {
            name: request.name,
            site_name: request.site_name,
            location: request.location,
            partner_name: request.partner_name,
            requested_time: request.requested_time,
            reason: request.reason
        });
        
        await sendEmail(request.email, getEmailSubject(emailType), emailHtml);

        res.json({ message: "Request status updated and email notification sent successfully." });
    } catch (error) {
        console.error("Error updating outsider request status:", error);
        res.status(500).json({ error: "Error updating request status." });
    }
};
