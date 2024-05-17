const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');
// const reviewController = require('../controllers/reviewController'); Xx: was required for the simple implementation of nested routes
const reviewRouter = require('./reviewRoutes');

const router = express.Router();

// router.param('id', tourController.checkID);

// Xx: implementing nested routes; basically routes within other routes, for example, review routes within tour routes
// POST /tour/23ds41/reviews Xx: to create a review to tour 23ds41
// GET /tour/23ds41/reviews Xx: to get reviews on tour 23ds41
// GET /tour/23ds41/reviews/923423frs Xx: to get review 923423frs on tour 23ds41

// Xx: implementations to get tour Id from the url and user id from logged in user in the reviewController
// router
//   .route('/:tourId/reviews')
//   .post(authController.protect, authController.restrictTo('user'), reviewController.createReview);
// Xx: removed, as this was a very simple implementation of nested routes and its not ideal, due to relating to reviews and being on tour router and also because of duplicate code in tourRouter and reviewRouter

router.use('/:tourId/reviews', reviewRouter);

router.route('/top-5-cheap').get(tourController.aliasTopTours, tourController.getAllTours);

// Xx: for error handling, instead of writing catchAsync in all CRUD operations in the tourController, could've simply used it here in the router (continues)
// Xx: for example, router.route('/tour-stats').get(catchAsync(tourController.getTourStats));
// Xx: the problem is this would require remembering everything that is async vs what is sync
// Xx: right now its not complex, but depending on the app, it could be
// Xx: so maybe easier to use it on each function as we are conding the function and know if its async or sync
router.route('/tour-stats').get(tourController.getTourStats);
router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan,
  );

router.route('/tours-within/:distance/center/:latlng/unit/:unit').get(tourController.getToursWithin);
// /tours-within/233/center/34.111745,-118.113491/unit/mi

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours)
  .post(authController.protect, authController.restrictTo('admin', 'lead-guide'), tourController.createTour); //Xx: chain middlewares by inputting one after the other and separating with ,

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.updateTour,
  )
  .delete(authController.protect, authController.restrictTo('admin', 'lead-guide'), tourController.deleteTour); // Xx: both admin and lead-guide can delete tours, but other users cant

module.exports = router;
