const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.patch('/confirmEmail/:token', authController.confirmEmail);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/loginOtp', authController.loginOtp);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

router.patch('/activateOtp', authController.activateOtp);

// Protect all routes after this middleware
router.use(authController.protect); // Xx: this will protect all routes that come after, as middleware runs in sequence

router.patch('/updateMyPassword', authController.updatePassword);

router.get('/me', userController.getMe, userController.getUser);
router.patch('/updateMe', userController.uploadUserPhoto, userController.resizeUserPhoto, userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);

router.patch('/registerOtp', authController.registerOtp);

router.use(authController.restrictTo('admin')); // Xx: restrict middleware applies to the routes coming after this middleware; only admin will have access to them

router.route('/').get(userController.getAllUsers).post(userController.createUser);
router.route('/:id').get(userController.getUser).patch(userController.updateUser).delete(userController.deleteUser); // Xx: when we want to pass a parameter, we use ":id"

module.exports = router;
