const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1) Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    // logger: true, // Xx: debug issues with MailTrap (from Q&A)
    secure: false, // Xx: needed to add this or MailTrap would not work (from Q&A)
    // Xx: also needed to use port 465 in config.env instead of 25 (from Q&A)
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    // service: 'Gmail',
    // auth: {
    //   user: process.env.EMAIL_USERNAME,
    //   pass: process.env.EMAIL_PASSWORD,
    // },
    // Xx: above is how to set up Gmail, for reference only; If using gmail (not recommended due to 500 email per day limit and you will be marked as spammer), need to activate in gmail "less secure app" option
    // Xx: first we will use a tool called Mailtrap which fakes sending e-mails to real addresses, but the e-mails end up trapped in a development inbox
    // Xx: we will user SendGrid later (I think this sends real emails?)
  });

  // 2) Define the email options
  const mailOptions = {
    // Xx: properties in this object come from when you pass the arguments when calling the function
    from: 'Xxxx Xxxx <xxxxxxxx@xxxx.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html:
  };

  // 3) Actually send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
