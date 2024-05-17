const multer = require('multer');
const sharp = require('sharp'); // Xx: image processing library for node.js, good for resizing images
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// Xx: commented out because we need to save the image to the memory and resize it before finally saving to disk
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     // Xx: this destination cant be simply set to a location as we had previously set; this destination must be set up as a callback function
//     // Xx: the callback function has access to the current request, to the currently uploaded file and to a callback function (cb) that acts similarly to next
//     cb(null, 'public/img/users'); // Xx: first we need to call the cb function and the first argument is an error if there is one (if not, then just null), the 2nd argument is the destination
//   },
//   filename: (req, file, cb) => {
//     // Xx: setting up filename to be user-userid-timestamp.jpeg
//     // Xx: file above is "req.file"
//     const ext = file.mimetype.split('/')[1]; // Xx: getting only jpeg from image/jpeg, per our console.log when we uploaded the first image as a test
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`); // Xx: same as destination, needs to be set up with a cb function, starting with the cb with the error and then the file name
//     // Xx: will have access to user because the user will be logged in when they upload the file
//   },
// });

const multerStorage = multer.memoryStorage(); // Xx: image is stored in buffer, so we get it from buffer when running sharp
// Xx: when we save to memory, the file name is not specified

const multerFilter = (req, file, cb) => {
  // Xx: to test if the file is an image; needs to be set up as a cb function; should return a true if the file is an image
  // Xx: again, must be set up as a callback function
  if (file.mimetype.startsWith('image')) {
    // Xx: no matter the file extension, if it is an image, it should start with image in mimetype
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// Xx: Multer is a very popular middleware to handle multi-part form data, wwhich is a form in coding thats used to upload files from a form
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});
// Xx: upload.single because we only allow 1 file and photo is the field in form which will receive the upload

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  // console.log(req.file)
  if (!req.file) return next();

  // Xx: redifining the file name, since name is not defined when saved to memory
  // Xx: instead of getting the file extension, we can always use.jpeg because we are converting the file to jpeg below anyway
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer) // Xx: async operation because there's multiple steps, so need to be awaited
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// Xx: to use the getOne factory function to getMe, we simply tell the function that req.params.id is the currently logged in user, add a login requirement before through routes, and add getOne from factory after
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError('This route is not for password updates. Please use /updateMyPassword instead for that.', 400),
    );
  }
  // 2) FIltered out unwanted field names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email'); // Xx: function created above; user should not be able to use this function to update fields other than name and email (for example, role????), so we filter out req.body to only get name and email
  if (req.file) filteredBody.photo = req.file.filename; // Xx: adding the photo file name to the filterObj in case there is a file

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, { new: true, runValidators: true });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead',
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);
// Do NOT update passwords with this (as the validators are not re-run)
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
