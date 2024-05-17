const Review = require('../models/reviewModel');
// const catchAsync = require('../utils/catchAsync'); // Xx: no longer needed after the factory
const factory = require('./handlerFactory');

// Xx: the specific portions for creating reviews (the bit of code to automatically get the tour and the user ids) is changed to a middleware to run just before the creation of reviews
exports.setTourUserIds = (req, res, next) => {
  // Allow nested routes
  if (!req.body.tour) req.body.tour = req.params.tourId; // Xx: if there is no tourId in the body get it from the tourId parameter in the url
  if (!req.body.user) req.body.user = req.user.id; // Xx: we get req.user.id from protect middleware
  next();
};

exports.getAllReviews = factory.getAll(Review);
exports.getReview = factory.getOne(Review);
exports.createReview = factory.createOne(Review);
exports.updateReview = factory.updateOne(Review);
exports.deleteReview = factory.deleteOne(Review);

// exports.getAllReviews = catchAsync(async (req, res, next) => {
//   let filter = {};
//   if (req.params.tourId) filter = { tour: req.params.tourId };

//   const reviews = await Review.find(filter);

//   res.status(200).json({
//     status: 'success',
//     results: reviews.length,
//     data: {
//       reviews,
//     },
//   });
// });

// exports.createReview = catchAsync(async (req, res, next) => {
//   // Allow nested routes
//   if (!req.body.tour) req.body.tour = req.params.tourId; // Xx: if there is no tourId in the body get it from the tourId parameter in the url
//   if (!req.body.user) req.body.user = req.user.id; // Xx: we get req.user.id from protect middleware
//   const newReview = await Review.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       tour: newReview,
//     },
//   });
// });
