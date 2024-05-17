const crypto = require('crypto');
const { promisify } = require('util'); // Xx: we only need promisify from util
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const otpGenerator = require('otp-generator');

// Xx: THINGS WERE GETTING TOO CONFUSING so decided to make and old version to leave old comments

const signToken = (id) => {
  // Xx: will simply receive id as the only input
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createLoginToken = catchAsync(async (user, statusCode, res) => {
  const token = signToken(user._id);
  user.authOperationAttempts += 1;
  user.lastAuthOperationAttemptAt = Date.now();
  await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    // secure: true, Xx: this option would make it so that the cookie is only sent via HTTPS, but our dev environment is not in HTTP, so we dont want it active in dev, only in production;
    // Xx: we remove it here and then add it through the if below if we are in production environment
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);

  // res.status(statusCode).json({
  //   status: 'success',
  //   token,
  // });
});

// Xx: this was the first implementation I did for confirmResetEmail, the token would be generated in this step, was having conflicts with new implementation of email system and website

// const sendConfirmResetEmail = catchAsync(async (url, operation, user) => {
//   const confirmResetToken = user.createConfirmResetToken();
//   await user.save({ validateBeforeSave: false });

//   let confirmResetURL;
//   let emailMessage;
//   let emailSubject;

//   if (operation === 'confirm') {
//     confirmResetURL = `${url}/api/v1/users/confirmEmail/${confirmResetToken}`;
//     emailMessage = `Please click this link (or copy and paste to your browser) to confirm your email: ${confirmResetURL}\nThis confirmation link is valid for 10 minutes.`;
//     emailSubject = 'Confirm your e-mail (valid for 10min)';
//   } else if (operation === 'reset') {
//     confirmResetURL = `${url}/api/v1/users/resetPassword/${confirmResetToken}`;
//     emailMessage = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${confirmResetURL}\nIf you did not forget your password, please ignore this e-mail.`;
//     emailSubject = 'Your password reset token (valid for 10min)';
//   }
//   // await sendEmail({
//   //   email: user.email,
//   //   subject: emailSubject,
//   //   message: emailMessage,
//   // });
//   await console.log({
//     email: user.email,
//     subject: emailSubject,
//     message: emailMessage,
//   });
// });

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
  // try {
  //   await sendConfirmResetEmail(url, 'confirm', newUser);
  // res.status(201).json({
  //   status: 'success',
  //   message: 'The confirmation link has been sent to your e-mail!',
  // });
  // } catch (err) {
  //   next(new AppError('Failed to send e-mail, please try again later.', 500));
  // }
});

exports.confirmEmail = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const newUser = await User.findOne({ confirmResetToken: hashedToken, confirmResetTokenExpires: { $gt: Date.now() } });
  if (!newUser) {
    return next(new AppError('Token is invalid or has expired.', 400));
  }
  // checkUserStatus(newUser, next);
  newUser.confirmResetToken = undefined;
  newUser.confirmResetTokenExpires = undefined;
  newUser.emailConfirmed = true;
  await newUser.save({ validateBeforeSave: false });
  const emailUrl = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, emailUrl).sendWelcome();
  createLoginToken(newUser, 201, res);
  // Xx: was able to implement e-mail confirmation on the webbsite, but it wont refresh automatically after confirming the e-mail, wanna go back on that later..
  next();
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
  createLoginToken(user, 200, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body; // Xx: create const pulling email and password from req.body automatically

  // 1) Check if email and password exist
  if (!email || !password) {
    //Xx: if we do not add the return here, it will give an error, saying that we cannot sent headers after they are sent to the client, because this tries to send headers, and then the res status below tries to send it again; we have to do return here so it is only sent once.
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
    .select('+otpCreatedAt'); //Xx: as seen before, when we wanna pass an argument such as email : email (email should be const email specified above), ES6 allows to abbreviate to simply email
  //Xx: select('+password') adds back a field that was being hidden with select
  //Xx: user is a document because it is querying the user module
  // const correct = await user.correctPassword(password, user.password);
  //Xx: correctPassword is an instance method, so it is available in all user documents
  if (!user || !(await user.correctPassword(password, user.password))) {
    // Xx: moved the const correct to here, because if user is not available, correct wont be able to get user.password
    return next(new AppError('Incorrect email or password', 401)); //Xx: 401 is unauthorized access
  }
  if (user.tooManyChanges()) {
    // Xx: we can call instance method in a User document
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
  if (!user.otpRegistrationComplete) createLoginToken(user, 200, res);
});

exports.loginOtp = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body; // Xx: create const pulling email and password from req.body automatically

  // 1) Check if email and password exist
  if (!email || !otp) {
    //Xx: if we do not add the return here, it will give an error, saying that we cannot sent headers after they are sent to the client, because this tries to send headers, and then the res status below tries to send it again; we have to do return here so it is only sent once.
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
    // Xx: moved the const correct to here, because if user is not available, correct wont be able to get user.password
    return next(new AppError('Incorrect email or otp, please login again', 401)); //Xx: 401 is unauthorized access
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
  createLoginToken(user, 200, res);
});

// Xx: httpOnly cookies cannot be manipulated nor deleted
// Xx: to log out the user, we send a new jwt cookie to overwrite the login one, but with no token and very short spanlife
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    // Xx: first is the cookie name, second is the info wwithin, third is the cookie options
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token; // Xx: read comment below about token inside if
  // Xx: per convention, usually the header name is Authorization and the value is 'Bearer ' + token
  // Xx: from the server side, we check if there is header and if it is the expected pattern
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]; // Xx: split with the space character and from the resulting array we want the 2nd element
    // Xx: first we were going to define token as a const inside the if, but then it would be limited to exist just inside the if, so we use let before before so it exists before the if and is available outside the if
  } else if (req.cookies.jwt && req.cookies.jwt !== 'loggedout') {
    // Xx: if there was no authentication header with Bearer token, check the cookies for jwt
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
    // Xx: we can call instance method in a User document
    return next(
      new AppError(
        'Too many login attempts or changes to the account in a short span of time! Please try again later',
        429,
      ),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser; // Xx: adding this line from isLoggedIn so that we can put the currentUser in the locals and we can use it in the templates, without having to use isLoggedIn
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  // Xx: the catchAsync in this function was catching an error when the logged out token was sent and wouldnt match the login
  // Xx: as when we built it, we dont want this function to catch any errors, instead the errors should be caught locally, so removed the catchAsync
  // Xx: only for rendered pages and the objective is not to protect any routes
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET); // Xx: once we log out the token fails this step of verification and goes to the catch block

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Checkk if user changed password after the token was issued
      // Xx: I changed this function to track account changes so I am not entirely sure if it checks PW changes
      if (currentUser.tooManyChanges(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser; // Xx: all pug templates will have access to "res.locals" and we are sending the user as a local variable in the templates
      return next();
    } catch (err) {
      return next(); // Xx: returning next() even in case of errors, so we are not actually catching anything
    }
  }
  next();
};

// Xx: usually you cant pass arguments into middlewares, so we create a wrapper function which will then return the middleware function we want
exports.restrictTo = (...roles) => {
  // Xx: this (...roles) gets the roles passed in the tourRoutes, basically 'admin' and 'lead-guide'
  return (req, res, next) => {
    // Xx: this is the middleware function itself
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      // Xx: per tourRoutes, by the time this middleware runs, protect middleware has already completed, so it can use data from req.user
      return next(new AppError('You do not have permission to perform this action', 403)); // Xx: 403 is the html code for forbidden/error due to lack of permission to do a certain operation
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const url = `${req.protocol}://${req.get('host')}`; // Xx: maybe I can just put url in config.env?
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that e-mail address.', 404)); //Xx: 404 means not found
  }

  // 2) Generate the random reset token
  // Xx: since we need to write a few lines of code, with mongoose, it is usually better to create a new instance method

  // 3) Send it to user's email
  try {
    // await sendConfirmResetEmail(url, 'reset', user);
    await new Email(user, reset);
    res.status(200).json({
      status: 'success',
      message: 'The password reset link has been sent to your e-mail!',
    });
  } catch (err) {
    next(new AppError('Failed to send e-mail, please try again later.', 500));
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
  createLoginToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select([
    '+password',
    '+authOperationAttempts',
    '+lastAuthOperationAttemptAt',
  ]); // Xx: this update Password will only be available for logged in users (implemented via routes), so we will already have current user in our object, it will come from the protect middleware
  // 2) Check if POSTed current password is correct
  // Xx: use correctPassword instance object, which is available in all user documents, takes in candidate PW and then the correct PW from DB
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
  createLoginToken(user, 200, res);
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
    // Xx: we can call instance method in a User document
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
    // Xx: we can call instance method in a User document
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
