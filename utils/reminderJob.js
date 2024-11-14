const cron = require('node-cron');
const db = require('../config/db');
const { sendEmail } = require('./EmailService');

// Schedule the job to run every hour
cron.schedule('0 * * * *', async () => {
    console.log("Running reminder job to check for overdue key returns.");

    try {
        // Select requests that were approved over 24 hours ago and not yet returned
        const [overdueRequests] = await db.query(`
            SELECT kr.id, kr.user_id, u.email, u.username, kr.site_id, s.name AS site_name, kr.approved_date
            FROM key_requests kr
            JOIN users u ON kr.user_id = u.id
            JOIN sites s ON kr.site_id = s.id
            WHERE kr.status = 'Approved'
            AND kr.approved_date <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        // Send reminder emails
        for (const request of overdueRequests) {
            const emailSubject = "Reminder: Return Key for Site Access";
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #FFA500; text-align: center;">Key Return Reminder</h2>
                    <p>Dear ${request.username},</p>
                    <p>This is a reminder that the key you requested for the site <strong>${request.site_name}</strong> should have been returned within 24 hours of approval.</p>
                    <p>Please make arrangements to return the key as soon as possible.</p>
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
                            <td style="padding: 8px; border: 1px solid #ddd; color: #FFA500;">Reminder</td>
                        </tr>
                    </table>
                    <p style="margin-top: 20px;">Best Regards,<br>Security Access Team</p>
                </div>
            `;

            try {
                await sendEmail(request.email, emailSubject, emailHtml);
                console.log("Reminder email sent to:", request.email);
            } catch (emailError) {
                console.error("Error sending reminder email:", emailError);
            }
        }

    } catch (error) {
        console.error("Error running reminder job:", error);
    }
});
