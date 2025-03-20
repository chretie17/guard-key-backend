const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your email provider or SMTP server
    auth: {
        user: 'aimableclass@gmail.com', 
        pass: 'olio uajx shtl ajsp',  
    },
});

const sendEmail = (to, subject, html) => {
    const mailOptions = {
        from: 'your-email@gmail.com',
        to,
        subject,
        html, 
    };

    return transporter.sendMail(mailOptions);
};


module.exports = { sendEmail };
