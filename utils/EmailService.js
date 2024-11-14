const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your email provider or SMTP server
    auth: {
        user: 'turachretien@gmail.com', 
        pass: 'ruix vmny qntx ywos',  
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
