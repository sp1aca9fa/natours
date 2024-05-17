const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 }, // Xx: per console.log initial test, even the imageCover becomes an array so when we want to retrieve it we need to retrieve it as an element of an array, [0]
  { name: 'images', maxCount: 3 },
  // Xx: set up way with multiple fields and different amounts of files being accepted Xx: will produce req.fileS in plural
]);

// upload.single('image') Xx: in case of only one field receiving one file Xx: will produce req.file
// upload.array('images', 3) Xx: if it's only one field receiving multiple files Xx: will produce req.fileS in plural

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  // console.log(req.files)

  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover imagge
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`; // Xx: instead of creating a variable with the image-cover name, we can just assign it to req.body, we need the image name in req.body anyway to update the DB
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];
  // req.files.images.foreach(async (file, i) => { Xx: the problem with this code was data only the callback function inside was async, not the loop itself
  // Xx: so the code would simply jump to next before completing the loop and the image names would not be persisted to the DB because it would not be able to pick the names of all files from the loop
  // Xx: to solve this issue we use map instea of foreach, we can then save an array of all the promises and then we can use promise.all to await until promise.all (all promises) is done
  await Promise.all(
    req.files.images.map(async (file, i) => {
      // Xx: loop to process each image; setting up the callback function in which we get acccess to the current file
      // Xx: in our callback function we also get access to the index of the image, so we can use it in the file name as 1, 2, 3
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`; // Xx: need to create a variable for filename this time so we can push it to the images array each time in the loop

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    }),
  );
  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
// Xx: call deleteOne function passing the model (Tour); factory function will return the handler we had here before, using Tour as Model
exports.deleteTour = factory.deleteOne(Tour);

// exports.getAllTours = catchAsync(async (req, res, next) => {
//   // EXECUTE QUERY
//   const features = new APIFeatures(Tour.find(), req.query).filter().sort().limitFields().paginate();
//   const tours = await features.query;

//   // Xx: not added the 404 handling error function added in get tour for example; Jonas says if we try to get all tours, but no results are shown, there is no error,
//   // Xx: as the command was successful, simply had no results; so no error handling needed

//   //SEND RESPONSE
//   res.status(200).json({
//     status: 'success',
//     results: tours.length,
//     data: {
//       tours,
//     },
//   });
// });

// exports.getTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findById(req.params.id).populate('reviews'); // Xx: virtual populate; only implementing in getTour, not all tours
//   // .populate({ path: 'guides', select: '-__v -passwordChangedAt' }); Xx: commenting it out, as it was added as middleware to tourModel in the end
//   // Xx: the 'populate('guides')' is all that is needed to replace the ids of the guides with the documents by the time we display the results, very simple and the res data looks as if it was embed all along
//   // Xx: changed to 'populate({ path: 'guides', select: '-__v -passwordChangedAt' })' to eliminate unwanted fields in the res
//   // Xx: using populate too frequently might impact performance, because it runs an additional query
//   // Tour.findOne({_id:req.params.id})

//   if (!tour) {
//     return next(new AppError('No tour with that ID', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour,
//     },
//   });
// });

// Xx: catchAsync is called when a function is called (instead of doing the function directly). catchAsync will then go back to function from which it was called returning the parameters for the function, but then catching errors through the catch block, if any. this is so we can eliminate having repeated catch blocks in each function.
// exports.createTour = catchAsync(async (req, res, next) => {
//   const newTour = await Tour.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       tour: newTour,
//     },
//   });
// });

// exports.updateTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//     runValidators: true,
//   });

//   if (!tour) {
//     return next(new AppError('No tour with that ID', 404));
//   }

//   res.status(200).send({
//     status: 'success',
//     data: tour,
//   });
// });

// Xx: old code before implementing the factory
// exports.updateTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//     runValidators: true,
//   });

//   if (!tour) {
//     return next(new AppError('No tour with that ID', 404));
//   }

//   res.status(200).send({
//     status: 'success',
//     data: tour,
//   });
// });

//Xx: old deleteTour before implementing factory
// exports.deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);
//   // Xx: was using await Tour.findByIdAndDelete(req.params.id) only; included 'const tour =' because of the error handling function below

//   if (!tour) {
//     return next(new AppError('No tour with that ID', 404));
//   }

//   res.status(204).json({
//     status: 'succes',
//     data: null,
//   });
// });

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' }, // Xx: used to define how we want to group the objects; becomes the _id going fowards in the function, can no longer access original _id
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
    // {
    //   $match: { _id: { $ne: 'EASY' } },
    // },
  ]);

  res.status(200).send({
    status: 'success',
    data: stats,
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1; // 2021

  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates', // Xx: unwind creates the same object for each of the values in the startDates array
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' }, // Xx: push creates an array with all the names
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        // Xx: serves to show (set as 1) or hide (set as 0) certain fields
        _id: 0,
      },
    },
    {
      $sort: { numTourStarts: -1 },
    },
    {
      $limit: 12,
    },
  ]);
  res.status(200).send({
    status: 'success',
    data: plan,
  });
});

// /tours-within?distance=233&center34.111745,-118.113491,unit=mi Xx: we could have the user input the queries by themselves and the result would be similar to this line, but we want something more clean and automatic, like the line below.
// /tours-within/233/center/34.111745,-118.113491/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1; // Xx: distance in radians is the distance divided by the radius of earth
  // Xx: radius of earth is different in km and mi so we need a turnery to use a different radius in mi and km

  if (!lat || !lng) {
    next(new AppError('Please provide latitude and longitude in latitude,longitude format.', 400));
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }, // Xx: mongodb always takes longitude first, then latitude
  });
  // Xx: geoWithin is a geometric operator to get objects within the distance from centersphere, distance measured in radians
  // Xx: in the video he was able to make a map show up in compass, but I was never really able to show the map.... the code appears to be working fine other than that

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(new AppError('Please provide latitude and longitude in latitude,longitude format.', 400));
  }
  // Xx: to do calculations we always? call the aggregation pipeline
  // Xx: for geospatial aggregation pipeline there is only geoNear
  // Xx: geoNear always needs to be the first stage in the pipeline
  // Xx: geoNear requires that one of the fields has a geospatial index (already done a 2dsphere index from startlocation)
  // Xx: if there are multiple fields with geospatial indexes, need to use the keys parameter to define which field to use
  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1], // Xx: the point from which we will calculate the distances; need to be specified as geojson
        },
        distanceField: 'distance', // Xx: the distance result is provided in meters by standard, so we need to add a multiplier based on the units used
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        // Xx: to remove unwanted fields and only show distance and tour name
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
