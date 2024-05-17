// review / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'The review cannot be empty!'],
      maxlength: [1000, 'The limit of characters is 1000!'],
    },
    rating: {
      type: Number,
      required: true,
      max: 5,
      min: 1,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Please specify the tour this review relates to!'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Please specify the author of this review!'],
    },
  },
  {
    // Xx: calls the virtual fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true }); // Xx: adding a compound index for tour and user that must be unique (for both tour and user, not for tour and user separately, so a single user can write many reviews and a tour can have various reviews)

reviewSchema.pre(/^find/, function (next) {
  // this.populate({ path: 'tour', select: 'name' }).populate({ path: 'user', select: 'name photo' });
  // Xx: only display name and photo; showing email would make our website more vulnerable to attacks
  this.populate({ path: 'user', select: 'name photo' });
  // Xx: removed the populate tour, because the reviews were being populated with the tours, so it did not make sense to populate the tours again within the reviews, it was adding unneeded extra queries
  next();
});

// Xx: static method
// Xx: in a static method, the this keyword points to the current model
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    // Xx: when we call aggregate, we need to call several stages with the data we want to aggregate
    // Xx: returns a promise so needs to be awaited
    {
      $match: { tour: tourId }, // Xx: will bring tour : tour
    },
    {
      $group: {
        _id: '$tour', // Xx: grouping all the tours by tour (to calculate the statistics)
        nRating: { $sum: 1 }, // Xx: adding 1 for each tour that matched in the previous step
        avgRating: { $avg: '$rating' }, // Xx: calculates the avg of "rating" field
      },
    },
  ]); // Xx: we are using a static method because aggregate needs to be called in the Model anyway
  // console.log(stats);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  // Xx: post middleware does not get access to next, so we cant call it
  // Xx: should use post because if we use pre the id is not available yet so it would not be able to match correctly
  // Xx: middleware to run the avgcalculation everytime we save a new review
  // this points to current review
  // Xx: using this to point out to the Model even though the Model is only called later;
  // Xx: we cant simply move this middleware to after the Model is called, otherwise it would not run, so we need to use this.constructor to call the Model within the middleware before actually calling it down below
  // Xx: this is the current document and constructor is the model who created it
  this.constructor.calcAverageRatings(this.tour);
});

// findByIdAndUpdate
// findByIdAndDelete
// Xx: the middleware to update review quantity and avg once a review is edited or deleted
// Xx: these queries do not actually save the doc, so we can only use query middleware, so we do not have access to the document, only to the query
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // Xx: findByIdAnd is jsut a shorthand for the mongoDB command findOneAnd
  this.r = await this.findOne(); // Xx: to get the review we're referring to in the query we run another query and save the query in a variable
  // console.log(this.r);
  next();
});

// Xx: we need to get the tour from pre (because post query, the query has already executed and we cant run it again), but we need to save post, so after the new review/deleted review is reflected in the DB
// Xx: which means we need to run a post middleware using arguments from pre middleware
// Xx: so instead of using const r in the pre, we use this.r, so the query is saved as a property, instead of a variable
// Xx: the property is accessible after the middleware has already ran
reviewSchema.post(/^findOneAnd/, async function () {
  await this.r.constructor.calcAverageRatings(this.r.tour);
  // Xx: calcAverageRatings is a static model and we need to call it in the model; so we get the model from this.r.constructor
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
