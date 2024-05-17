const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = Object.values(err.keyValue)[0];
  // Xx: using "[0]" to return the first element of the string
  // Xx: from recommended questions, the field with the duplicate name description apparently changed
  // Xx: original solution from Jonas: const value = err.errmsg.match(/<regular expression to get text between quotes>/), but "errmsg" is no longer used
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message); //el => el.message is to specify that we want message from the mapped element
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const sendErrorDev = (err, req, res) => {
  // Xx: adding access to the request by adding req here, because we need req to get req.originalUrl
  // Xx: also included req when calling sendErrorDev in the module.exports below
  // Xx: checking if the url starts with /api, to know if we are in the API or in the website
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
  // B) RENDERED WEBSITE
  console.error('ERROR 🧨', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
// Xx: ES6 allows to write one-line codes where we dont need curly braces and neither return, so it will automatically and implicitily return what we write after
// Xx: first was using "err" in the parenthesis, but since we dont call err, erased it, as it is not needed

const handleJWTExpired = () => new AppError('Token expired. Please log in again.', 401);

const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // Xx: adding access to the request by adding req here, because we need req to get req.originalUrl
    // Xx: also included req when calling sendErrorProd in the module.exports below
    // A) Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // B) Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error('ERROR 🧨', err);

    // 2) Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
  // B) RENDERED WEBSITE
  // A) Operational, trusted error: send message to client
  if (err.isOperational) {
    console.log(err);
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message,
    });
  }
  // B) Programming or other unknown error: don't leak error details
  // 1) Log error
  console.error('ERROR 🧨', err);

  // 2) Send generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again.',
  });
};

module.exports = (err, req, res, next) => {
  // console.log(err.stack);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message; // Xx: included this line later; Jonas realized the issue that error was not actually getting all properties from err, so forcefully made error.message = err.message to get the message inside error

    if (err.name === 'CastError') error = handleCastErrorDB(error);
    // Xx: for some reason, even though error should be a copy? or a new instance of err, it wont receive the name property correctly; as such, need to get name from original error in the conditionals, as error.name is undefined.
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    // Xx: same reason as previous comment above, getting name from original err instead of from error due to error.name being undefined
    if (error.name === 'JsonWebTokenError') error = handleJWTError(); // Xx: 1) for some reason, error.name works here... weird; 2) error is not used in the function, so no need to pass it in parenthesis
    if (error.name === 'TokenExpiredError') error = handleJWTExpired();

    sendErrorProd(error, req, res);
  }
};
