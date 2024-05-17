const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');

// Start express app
const app = express();

app.set('view engine', 'pug'); // Xx: setting the template engine to pug
app.set('views', path.join(__dirname, 'views')); // Xx: it's not ideal to set file locations in the usual pattern (example, './views'), as this is the directory where we start the app from
// Xx: in some cases we might start the app from a different location, so its better to use a directory environment variable
// Xx: path.join is used instead of just __dirname because we dont know if the path from __dirname will have the / at the end or not and this is a common cause for bugs

// 1) GLOBAL MIDDLEWARES

// Serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));
// Set security HTTP headers
// app.use(helmet()); // Xx: helmet is a collection of a few small security related middlewares and is generally recommended for all projects

// Xx: from Q&A, needed to make leaflet work
// Further HELMET configuration for Security Policy (CSP)
const scriptSrcUrls = ['https://unpkg.com/', 'https://tile.openstreetmap.org', 'https://js.stripe.com'];
const styleSrcUrls = ['https://unpkg.com/', 'https://tile.openstreetmap.org', 'https://fonts.googleapis.com/'];
const connectSrcUrls = [
  'https://unpkg.com',
  'https://tile.openstreetmap.org',
  'https://stripe.com/',
  'ws://127.0.0.1:*/',
];
const fontSrcUrls = ['fonts.googleapis.com', 'fonts.gstatic.com'];

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: [],
      connectSrc: ["'self'", ...connectSrcUrls],
      scriptSrc: ["'self'", ...scriptSrcUrls],
      styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
      workerSrc: ["'self'", 'blob:'],
      frameSrc: ["'self'", 'https://js.stripe.com'],
      objectSrc: [],
      imgSrc: ["'self'", 'blob:', 'data:', 'https:'],
      fontSrc: ["'self'", ...fontSrcUrls],
    },
  }),
);

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  //Xx: object with rateLimit options
  max: 100, //Xx: allow 100 requests in the window below
  windowMs: 60 * 60 * 100, //Xx: window of miliseconds
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // Xx: setting req.body limit to 10kb; if you need to accept files, max file size would need to be considered here too, unless I use a specific link to have a greater limit, link /api or etc
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Xx: this is needed to parse encoded url content if we are using post from HTML

// Xx: Cookie parser
app.use(cookieParser());

// Data sanitization against NoSql query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution (Xx: using the same parameter, such as sort, twice, it apply only the last one);
// Xx: whitelist allows use of double parameters and shows results correctly, like '/tours?duration=5&duration=9'
app.use(
  hpp({
    whitelist: ['duration', 'ratingsAverage', 'ratingsQuantity', 'maxGroupSize', 'difficulty', 'price'],
  }),
);

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  // Xx: .all is all html requests (CRUD)
  next(new AppError(`Cannot find ${req.originalUrl} on this server.`, 404)); // Xx: whenever we pass anything into next(), express understands it is an error and will skip all middleware after that
});

app.use(globalErrorHandler);

module.exports = app;

// 4) START SERVER
