const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const otpGenerator = require('otp-generator');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// const createLoginToken = catchAsync(async (user, statusCode, res) => {
const createLoginToken = catchAsync(async (req, user, statusCode, res) => {
  const token = signToken(user._id);
  user.authOperationAttempts += 1;
  user.lastAuthOperationAttemptAt = Date.now();
  await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    // Xx: simplifying the code even further than below, instead of putting it outside of cookieOptions, just set it to here based on the boolean result of the statement
  };
  // Xx: need to change from the above; in some cases, the application is not delivered securely by the deploying service, so this if specifically checks if the connection is secure.
  // Xx: need to change from the above; in some cases, the application is not delivered securely by the deploying service, so this if specifically checks if the connection is secure.
  // Xx: req.secure would check if the request is secure, but Heroku, for example, forwards all requests internally, so checking if it has a forwarded header; not sure exactly how it works for render, but should be similar?
  // if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  // if (req.secure || req.headers['x-forwarded-proto'] === 'https') cookieOptions.secure = true;
  // cookieOptions.secure = req.secure || req.headers['x-forwarded-proto'] === 'https'; // Xx: instead of doing an if, just set the cookies.secure to the boolean resulting from the sentence; if its true, then cookies.secure = true, cause the statement is true

  res.cookie('jwt', token, cookieOptions);

  if (!req.get('Content-Type') === 'application/json') {
    res.status(statusCode);
    res.redirect('/me');
  } else {
    res.status(statusCode).json({
      status: 'success',
      token,
    });
  }
});

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });
  const confirmResetToken = newUser.createConfirmResetToken();
  await newUser.save({ validateBeforeSave: false });
  const emailUrl = `${req.protocol}://${req.get('host')}/confirmEmail/${confirmResetToken}`;
  await new Email(newUser, emailUrl).confirmEmail();

  res.status(201).json({
    status: 'success',
    message: 'The confirmation link has been sent to your e-mail!',
  });
});

exports.confirmEmail = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const newUser = await User.findOne({ confirmResetToken: hashedToken, confirmResetTokenExpires: { $gt: Date.now() } });
  if (!newUser) {
    return next(new AppError('Token is invalid or has expired.', 400));
  }
  newUser.confirmResetToken = undefined;
  newUser.confirmResetTokenExpires = undefined;
  newUser.emailConfirmed = true;
  await newUser.save({ validateBeforeSave: false });
  const emailUrl = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, emailUrl).sendWelcome();
  createLoginToken(req, newUser, 201, res);
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ confirmResetToken: hashedToken, confirmResetTokenExpires: { $gt: Date.now() } });
  if (!user) {
    return next(new AppError('Token is invalid or has expired.', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.confirmResetToken = undefined;
  user.confirmResetTokenExpires = undefined;
  await user.save();
  createLoginToken(req, user, 200, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  // 2) Check if the user exists && password is correct
  const user = await User.findOne({ email })
    .select('+password')
    .select('+authOperationAttempts')
    .select('+lastAuthOperationAttemptAt')
    .select('+emailConfirmed')
    .select('+otp')
    .select('+otpRegistrationComplete')
    .select('+otpCreatedAt');
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }
  if (user.tooManyChanges()) {
    return next(
      new AppError(
        'Too many login attempts or changes to the account in a short span of time! Please try again later',
        429,
      ),
    );
  }
  if (!user.emailConfirmed) {
    return next(new AppError('Email is not confirmed yet!', 401));
  }
  if (user.otpRegistrationComplete) {
    user.otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    user.otpCreatedAt = Date.now() - 1000;
    await user.save({ validateBeforeSave: false });
    try {
      console.log(user.otp);
      // Xx: the code works, but commenting out to avoid sending e-mails due to monthly email limit
      // await sendEmail({
      //   email: user.email,
      //   subject: 'Complete the two step authentication registration',
      //   message: `Your one-time verification code is ${user.otp}.\nPlease send a PATCH request to ${req.protocol}://${req.get('host')}/api/v1/users/activateOtp with e-mail address and the otp received in the body to complete registration.`,
      // });
      res.status(200).json({
        status: 'success',
        message: `The one-time verification code has been sent to your e-mail! Please POST it to ${req.protocol}://${req.get('host')}/api/v1/users/loginOtp with e-mail address to login.`,
      });
    } catch (err) {
      next(new AppError('Failed to send e-mail, please try again later.', 500));
    }
  }
  // 3) If everything ok, send token to client
  if (!user.otpRegistrationComplete) createLoginToken(req, user, 200, res);
});

exports.loginOtp = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  // 1) Check if email and password exist
  if (!email || !otp) {
    return next(new AppError('Please provide email and otp', 400));
  }
  // 2) Check if the user exists && password is correct
  const user = await User.findOne({ email }).select(['+otp', '+otpRegistrationComplete', 'otpCreatedAt']);
  await user.save({ validateBeforeSave: false });
  if (user.tooManyChanges()) {
    return next(
      new AppError(
        'Too many login attempts or changes to the account in a short span of time! Please try again later',
        429,
      ),
    );
  }
  if (parseInt(user.otpCreatedAt.getTime()) + 2 * 60 * 1000 < Date.now()) {
    return next(new AppError('The otp is only valid for 2 minutes, please try again', 401));
  }
  if (!user || user.otp !== otp) {
    return next(new AppError('Incorrect email or otp, please login again', 401));
  }
  if (!user.otpRegistrationComplete) {
    return next(
      new AppError('You do not have 2-step verification activated. Please login through the main page.', 401),
    );
  }
  // 3) If everything ok, send token to client
  user.otp = undefined;
  user.otpCreatedAt = undefined;
  await user.save({ validateBeforeSave: false });
  createLoginToken(req, user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    // Xx: first is the cookie name, second is the info within, third is the cookie options
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token; // Xx: read comment below about token inside if
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt && req.cookies.jwt !== 'loggedout') {
    token = req.cookies.jwt;
  } else if (req.cookies.jwt === 'loggedout') return res.redirect('/');

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401)); // Xx: 401 is access unauthorized
  }

  // 2) Verify token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET); //Xx: verify is a sync method, so we want to promisify that in line with the rest of our code using util.promisify

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id).select('+lastAuthOperationAttemptAt');
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists', 401)); // Xx: the message only appeared correctly on dev mode, not prod mode?
  }
  // 4) Check if user changed password after the token was issued
  if (currentUser.tooManyChanges(decoded.iat)) {
    return next(
      new AppError(
        'Too many login attempts or changes to the account in a short span of time! Please try again later',
        429,
      ),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Checkk if user changed password after the token was issued
      if (currentUser.tooManyChanges(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const url = `${req.protocol}://${req.get('host')}`;
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that e-mail address.', 404));
  }

  // 2) Generate the random reset token
  const confirmResetToken = user.createConfirmResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${confirmResetToken}`;
    // await sendConfirmResetEmail(url, 'reset', user);
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'The password reset link has been sent to your e-mail!',
    });
  } catch (err) {
    user.confirmResetToken = undefined;
    user.confirmResetTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('Failed to send e-mail, please try again later.', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ confirmResetToken: hashedToken, confirmResetTokenExpires: { $gt: Date.now() } });
  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired.', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.confirmResetToken = undefined;
  user.confirmResetTokenExpires = undefined;
  await user.save();
  // 3) Update changedPasswordAt property for the user Xx: done in userModel
  // 4) Log the user in, send the JWT
  createLoginToken(req, user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select([
    '+password',
    '+authOperationAttempts',
    '+lastAuthOperationAttemptAt',
  ]);
  // 2) Check if POSTed current password is correct
  // await user.save({ validateBeforeSave: false });
  if (user.tooManyChanges()) {
    // Xx: we can call instance method in a User document
    return next(
      new AppError(
        'Too many login attempts or changes to the account in a short span of time! Please try again later',
        429,
      ),
    );
  }
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Current password is incorrect, please try again.', 401));
  }
  if (await user.correctPassword(req.body.password, user.password)) {
    return next(new AppError('The new password is the same as the current password', 401));
  }
  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as inteded (Xx: will not run pre save middlewares and will not validate confirmPassword)
  // 4) Log user in, send JWT
  createLoginToken(req, user, 200, res);
});

exports.registerOtp = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email }).select([
    '+password',
    '+otpRegistrationComplete',
    '+otp',
    '+otpCreatedAt',
    '+authOperationAttempts',
    '+lastAuthOperationAttemptAt',
  ]);
  await user.save({ validateBeforeSave: false });
  if (user.tooManyChanges()) {
    return next(
      new AppError(
        'Too many login attempts or changes to the account in a short span of time! Please try again later',
        429,
      ),
    );
  }
  if (!user) {
    return next(new AppError('There is no user with that e-mail address.', 404));
  }
  // checkUserStatus(user, next);
  if (user.otpRegistrationComplete) {
    return next(new AppError('Two step authentication is already active.', 401));
  }
  if (!(await user.correctPassword(req.body.password, user.password))) {
    return next(new AppError('Password is incorrect.', 401));
  }
  user.otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
  user.otpCreatedAt = Date.now() - 1000;
  await user.save({ validateBeforeSave: false });
  try {
    // Xx: the code works, but commenting out to avoid sending e-mails due to monthly email limit
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Complete the two step authentication registration',
    //   message: `Your one-time verification code is ${user.otp}.\nPlease send a PATCH request to ${req.protocol}://${req.get('host')}/api/v1/users/activateOtp with e-mail address and the otp received in the body to complete registration.`,
    // });
    res.status(200).json({
      status: 'success',
      message: `The one-time verification code has been sent to your e-mail! Please follow the steps in the e-mail to complete registration.`,
    });
  } catch (err) {
    next(new AppError('Failed to send e-mail, please try again later.', 500));
  }
});

exports.activateOtp = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email }).select([
    '+otpRegistrationComplete',
    '+otp',
    '+otpCreatedAt',
    '+authOperationAttempts',
    '+lastAuthOperationAttemptAt',
  ]);
  await user.save({ validateBeforeSave: false });
  if (user.tooManyChanges()) {
    return next(
      new AppError(
        'Too many login attempts or changes to the account in a short span of time! Please try again later',
        429,
      ),
    );
  }
  if (!user) {
    return next(new AppError('There is no user with that e-mail address.', 404));
  }
  // checkUserStatus(user, next);
  if (user.otpRegistrationComplete) {
    return next(new AppError('Two step authentication is already active.', 401));
  }
  if (parseInt(user.otpCreatedAt.getTime()) + 2 * 60 * 1000 < Date.now()) {
    return next(new AppError('The otp is only valid for 2 minutes, please try again', 401));
  }
  if (req.body.otp === user.otp) {
    user.otpRegistrationComplete = true;
    user.otp = undefined;
    await user.save({ validateBeforeSave: false });
    // createLoginToken(user, 201, res);
    res.status(201).json({
      status: 'success',
      message: '2-step authentication is now activated! Please login again.',
    });
  } else {
    res.status(401).json({
      status: 'success',
      message: 'The otp is incorrect, please try again',
    });
  }
});
