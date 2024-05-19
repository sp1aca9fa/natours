const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');
// const bookingController = require('../controllers/bookingController');

const router = express.Router();

// Xx: for views, we do not need post, patch, delete, we just need get
// Xx: example of route implemented as an example in the original code (before creating viewRoutes and viewsController)
// router.get('/', (req, res) => {
//   res.status(200).render('base', {
//     tour: 'The Forest Hiker',
//     user: 'Jonas',
//   }); // Xx: instead of json, we use render to set the view and it will get it from views folder, since we set it up at the top
//   // Xx: stuff that we pass after 'base' is data that we want to pass on to pug
// });

// router.use(authController.isLoggedIn); // Xx: will apply to all routes below
// Xx: removed the isLoggedIn applying to following lines, as we dont want isLoggedIn to run when we are running protect, since it is a lot of duplicate code and includes duplicate query

// router.get('/', bookingController.createBookingCheckout, authController.isLoggedIn, viewsController.getOverview); // Xx: the createBookingCheckout is before other middlewares as a temporary solution, need to do a better implementation/require authentication/protection once deploying the website
router.get('/', authController.isLoggedIn, viewsController.getOverview); // Xx: removing createBookingCheckout as no longer needed after safe implementation
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/me', authController.protect, viewsController.getAccount);
router.get('/me', authController.protect, viewsController.updateUserData);
router.get('/my-bookings', authController.protect, viewsController.getMyBookings);
router.get('/confirmEmail/:token', authController.confirmEmail);

// router.post('/submit-user-data', authController.protect, viewsController.updateUserData); Xx: route that we used to update userdata via html method

// /login router, create a controller and a template. the template is just some static html and no need to pass any variables

module.exports = router;
