const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');
const catchAsync = require('../utils/catchAsync');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 5, // The document will be automatically deleted after 5 minutes of its creation time
  },
});
// Define a function to send emails
const sendOtpEmail = catchAsync(async (email, otp, next) => {
  try {
    await sendEmail({
      email,
      subject: 'Verification Email',
      message: `Your one-time verification code is ${otp}. Please insert this token to continue with your login`,
    });
  } catch (err) {
    next(new AppError('Failed to send e-mail, please try again later.', 500));
  }
});

otpSchema.pre('save', async function (next) {
  // Only send an email when a new document is created
  if (this.isNew) {
    await sendOtpEmail(this.email, this.otp);
  }
  next();
});
module.exports = mongoose.model('OTP', otpSchema);
