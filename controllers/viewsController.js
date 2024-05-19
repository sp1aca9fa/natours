const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');

exports.alerts = (req, res, next) => {
  const { alert } = req.query;
  if (alert === 'success') res.locals.alert = 'Your booking was successful! Please check your e-mail.';
  next();
};

exports.getOverview = catchAsync(async (req, res, next) => {
  // Xx: need a next for the catchAsync function to workk
  // 1) Get tour data from collection
  const tours = await Tour.find();

  // 2) Build template

  // 3) Render that template using t our data from 1)

  res.status(200).render('overview', {
    title: 'All Tours',
    tours, // Xx: passing the data to the templates
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) Get the data for the requested tour (including reviews and guides)
  // Xx: findById accepts a string, but findOne needs an object, so we need to pass it like the below
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review user rating',
  });
  // Xx: we have an auto-populate function for the guides, but apparently we need to populate the reviews too?

  if (!tour) {
    return next(new AppError('There is no tour with that name.', 404));
  }

  // 2) Build template (will do together, no need to do it)
  // 3) Render template using data from 1)
  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});

exports.getLoginForm = (req, res) => {
  res
    .status(200)
    // .set('Content-Security-Policy', "connect-src 'self' ws://127.0.0.1:*/ https://cdnjs.cloudflare.com")
    // Xx: dont remember why I added the above, but then had to add ws://127.0.0.1:*/ because of a console error in the client
    // Xx: but removing it apparently results in no errors, so just leaving it here
    .render('login', {
      title: 'Login',
    });
};

exports.getAccount = (req, res, next) => {
  res.status(200).render('account', {
    title: 'Your account',
  });
};

exports.getMyBookings = catchAsync(async (req, res, next) => {
  // Xx: steps to implement
  // Xx: 1) implemented route
  // Xx: 2) created this function
  // Xx: 3) implemented the link in the account.pug

  // Xx: a virtual populate should do something similar to this, but Jonas wanted to show us how to manually do it
  // 1) Find all user's bookings
  const bookings = await Booking.find({ user: req.user.id });

  // 2) Find tours with the returned IDs from
  const tourIDs = bookings.map((el) => el.tour);
  // Xx: using map to create a new array based on a cbf
  // Xx: this will loop through the entire bookings array and on each element it will grab the tour
  const tours = await Tour.find({ _id: { $in: tourIDs } }); // Xx: will select all tours which have an id that are in the tourIDs array

  res.status(200).render('overview', {
    // Xx: using the existing overview template to use the same cards, but instead will return the user's bookings
    title: 'My bookings',
    tours,
  });
});

exports.updateUserData = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(
    // Xx: we will protect this route (so only the logged user can update their own account) and as a result the user.id will be received from there
    req.user.id,
    {
      name: req.body.name, // Xx: name and email are used here because we gave the name attribute to these fields in the form through the pug template
      email: req.body.email,
    },
    {
      new: true,
      runValidators: false,
    },
  );

  res.status(200).render('account', {
    title: 'Your account',
    user: updatedUser,
  });
});
