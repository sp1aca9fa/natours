const crypto = require('crypto'); //Xx: to be used to generate the random token; built-in module, no need to install
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

// name, email, photo, password, passwordConfirm

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please input your name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please input your e-mail address'],
    unique: [true, 'This e-mail address is already in use'],
    lowercase: true,
    validate: [validator.isEmail, 'Please insert a valid e-mail address'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please input your password'],
    minlength: 8,
    select: false, //Xx: hides the PW from body response
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      validator: function (el) {
        return el === this.password; //Xx: same as on tourModel, this validation only works on CREATE and SAVE (meaning, when we want to update, we will need to use SAVE too)
      },
      message: 'Password confirmation does not match password',
    },
  },
  changedPasswordAt: Date,
  authOperationAttempts: {
    type: Number,
    default: 1,
    select: false,
  },
  lastAuthOperationAttemptAt: {
    type: Date,
    default: Date.now(),
    select: false,
  },
  confirmResetToken: String,
  confirmResetTokenExpires: Date,
  emailConfirmed: {
    type: Boolean,
    default: false,
    select: false,
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  otpRegistrationComplete: {
    type: Boolean,
    default: false,
    select: false,
  },
  otp: {
    type: Number,
    default: 0,
    select: false,
    minlength: 6,
    maxlength: 6,
  },
  otpCreatedAt: {
    type: Date,
    default: Date.now(),
    select: false,
  },
});

// XX: NEED TO REMOVE THIS BEFORE IMPORTING DB OTHERWISE IT WILL HASH AGAIN WHAT IS ALREADY HASHED
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next(); // Xx: this refers to the current document, in this case the current user, pass in the () the field modified

  // Xx: "hashing (encrypting) the PW"
  // Xx: bcrypt(?) will salt the PW, meaning it will add a random string to the PW so that 2 equal PWs do not generate the same hash
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12); // Xx: hash function is async, so we need to await it; then, because of that, need to add async in the beginning
  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (this.isModified() && !this.isModified('-otp')) return next();
  this.authOperationAttempts += 1;
  this.lastAuthOperationAttemptAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } }); // Xx: setting as not equal to false instead of equal to true, since users created before active property was inserted do not have it
  next();
  // Xx: using a regular expression to get all commands that start with the word "find", including findandupdate, findanddelete, etc]
  // Xx: regex for words that start with x is /^x/
}); // Xx: will happen before a find (query), which is what makes this a query middleware

// Xx: instance method
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  this.authOperationAttempts += 1;
  this.lastAuthOperationAttemptAt = Date.now() - 1000;
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.createConfirmResetToken = function () {
  const unhashedToken = crypto.randomBytes(32).toString('hex');
  this.confirmResetToken = crypto.createHash('sha256').update(unhashedToken).digest('hex');
  this.confirmResetTokenExpires = Date.now() + 10 * 60 * 1000;
  return unhashedToken;
};

// Xx: also an instance method
// Xx: I dont understand how JWTTimestamp is able to get the time correctly.. need to double check in the future
userSchema.methods.tooManyChanges = function () {
  if (this.authOperationAttempts >= process.env.USER_TOO_MANY_CHANGES) {
    return Date.now() < parseInt(this.lastAuthOperationAttemptAt.getTime() + 10 * 60 * 1000); // If the timestamp the JWT was issued at is greater than changedtimestamp then it makes sense and it would be false and no problem
  }
  // False means NOT changed
  return false;
};

const User = mongoose.model('User', userSchema); // Xx: model variables start with capital letter per convention;
// Xx: mongoose.model(name of the model, created out of the Schema we mentioned before)

module.exports = User;
