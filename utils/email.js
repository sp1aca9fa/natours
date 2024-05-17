const nodemailer = require('nodemailer');
const pug = require('pug');
const { htmlToText } = require('html-to-text');

// Xx: SEE OLD FILE FOR OLD COMMENTS AND HOW WE MADE IT WITH NODEMAILER IN THE BEGINNING

// new Email(user, url).sendWelcome(); // Xx: example of how we would use the Email class; we would start a new email, pass the user containing both e-mail address and name, passing a url
// Xx: then we want to call the method that is actually going to send the e-mail, for example, sendWelcome would be the e-mail we send when the user signs up to our app

module.exports = class Email {
  // Xx: a class needs a constructor function, which is basically the function that is going to be running when a new object is created through this class
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Xxxx Xxxx <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    // Xx: we want to change between dev mode and production mode, so production mode sends real emails and dev mode uses the nodemailer (or maybe just console.log in my case.....)
    if (process.env.NODE_ENV === 'production') {
      // To implement Sendgrid later
      return nodemailer.createTransport({
        service: 'SendGrid', // Xx: nodemailer already recognizes SendGrid, so we do not need to register the smtp, the port, anything, it's already pre-defined
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    // Xx: creating the send method. This is the method that will do the actual sending. This will receive a template and a subject
    // Xx: this is because when we create the other send methods, like sendWelcome, it wont receive any arguments and it will simply call send() with the template and the subject that we want for the e-mail
    // Xx: this makes it very easy to create different emails for different kinds of situation

    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });
    // Xx: we cant just use render like when we do res.render, because render basically creates the html based on the template and then sends to the client
    // Xx: we dont want to render in this case, we just want to create the html out of the template so that we can send that html as the email
    // Xx: we can define the html in the mailOptions, similar to how we define the text, and we can use the pug template as that html
    // Xx: pug.renderFile will take in the file and render the pug code into real html

    // 2) Define the email options
    const mailOptions = {
      from: this.from, // Xx: coming from the constructor
      to: this.to,
      subject,
      html,
      text: htmlToText(html), // Xx: in addition to the html email, its good practice to also send the simple text to enahnce visibility/compatibility, increase delivery rates and avoid going to spam folder
      // Xx: using html-to-text pkg to convert directly here (just need to say fromString and pass in the string, in this case var html)
    };

    // 3) Create a transport and send email
    // await this.newTransport().sendMail(mailOptions);
    console.log('URL in the email that would be sent:');
    console.log(this.url);

    // Xx: here we need to await until the e-mail is sent
    // Xx: this means that send should be an async function because we need to wait until the e-mail is sent
    // Xx: finally we need to mark all functions using send() as async await, such as sendWelcome
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async confirmEmail() {
    await this.send('confirmEmail', 'Please confirm your e-mail');
  }

  async sendPasswordReset() {
    await this.send('passwordReset', 'Your password reset e-mail (valid for only 10minutes)');
  }
};
