import nodemailer from "nodemailer";


// Helper function to send OTP email
async function sendOTPEmail(email, otp) {
    // Use the MailTrap configuration to send the email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  
    const mailOptions = {
      from: `"Authentification Token" <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: 'Verification Email',
      text: `To complete your sign up, your verification code is: ${otp}`,
    };
  
    await transporter.sendMail(mailOptions);
  }

  export default sendOTPEmail;