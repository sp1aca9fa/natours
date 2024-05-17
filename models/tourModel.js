const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel'); // Xx: only needed if we are embedding, not needed for referencing
//const validator = require('validator'); Xx: in the end we ended up not using, so commenting out

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please specify the tour name'],
      unique: true,
      trim: true,
      maxlength: [40, 'The tour name must be 40 or less characters long'],
      minlength: [10, 'The tour name must be 10 or more characters long'],
      // validate: [validator.isAlpha, 'The tour must only contain letters'], // Xx: using validator library, very useful to validate and sanitize a bunch of stuff
      // Xx: isAlpha does not allow for spaces, so we removed it in the end
      // Xx: to check if the string only contains letters and spaces, it might be simpler to use a regex, he said
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'Please specify the tour duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'Please specify the group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'Please specify the tour difficulty'],
      enum: {
        // Xx: only works with strings
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty must be easy, medium or difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be at least 1'], // Xx: also works with dates
      max: [5, 'Rating must be 5 or lower'],
      set: (val) => Math.round(val * 10) / 10, // Xx: set is used to round the review score; it takes a function and we do the rouning with Math.round
      // Xx: Math.round usually returns an integer tho, so we must do (val * 10) /10 to get 1 decimal
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'Please specify the tour price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this only points to current doc on NEW document creation (Xx: meaning, the validator wont work for updates)
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be lower than standard price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'Please input the tour summary'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'Please upload the cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // Xx: this is an embedded document with the GeoJSON properties
      // GeoJSON
      // Xx: GeoJSON requires at least type and coordinates
      type: {
        // Xx: this is the schema type for type
        type: String,
        default: 'Point', // Xx: for GeoJSOn, usually the default type is point, but there are other geometric forms that can be used
        enum: ['Point'],
      },
      coordinates: [Number], // Xx: expecting an array of numbers containing the coordinates (same as google maps, first latitude and then longitude)
      address: String,
      description: String,
    },
    locations: [
      // Xx: to create an object embedded in another object we need to create an array and then create the object inside that array
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // guides: Array, // Xx: use it this way if we want to embed guides as docs, in addition to require User schema and the embedding function commented out below
    guides: [
      { type: mongoose.Schema.ObjectId, ref: 'User' }, // Xx: this means we expect the type to be a mongoose db object id
    ],
  },
  {
    // Xx: calls the virtual fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Xx: single field index; we set price as an index, so that mongoDB does not need to go through all documents to return the queries we send.
// Xx: usually a good idea to set index to fields that are queried frequently
// tourSchema.index({ price: 1 }); // Xx: price: 1 or price: -1, -1 would arrange in descending order

// Xx: compound index, index with 2 or more fields that are queried freqneutly to improve performance
// Xx: compound index will also work when we query for either of the 2 fields individually
// Xx: on the other hand, indexes consume resources and need to be updated each time we update one of the objects
// Xx: so always good to analyze the data and see the real fields that would benefit most from indexes
// Xx: unique fields always automatically have indexes
tourSchema.index({ price: 1, ratingsAverage: -1 });
// Xx: in the future we will query tours by their slugs, which means slug will be the most queried field, so setting up a slug index
tourSchema.index({ slug: 1 });
// Xx: if we no longer need an index, we actually need to delete it in mongoDB, otherwise it will remain there

tourSchema.index({ startLocation: '2dsphere' }); // Xx: indexes for geospatial data need to be 2dsphere index if real points in life on earth or 2d index if we are only using fictional data

// Xx: creates a virtual field, so its not saved to the DB, since it can be derived from DB and does not actually need to be saved.
// Xx: we need to use normal functions without arrow with MongoDB? Mongoose? so that we can use the this command
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// Virtual populate
// Xx: virtual populate brings infos from other dbs as if they were embed in the object
// Xx: to finish implementing, need to add the populate command citing the virtual field in the controller.
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', // Xx: type the field we want to pick up from reviewModel
  localField: '_id', // Xx: we need to specify where the same info as foreignField is stored in this current model
});

// DOCUMENT MIDDLEWARE: only runs before .save() and .create (), does not run with findbyID for example
// Xx: pre save middleware or hook, some people call them as hooks
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Xx: this is an example of function to embed users into the tours by switching the ids to the actual user documents from the ids
// Xx: this code only works for new docs, does not work when updating the docs or tours
// Xx: this is because it would require a bunch of additional operations each time there was changes in the tours or in the users (and a bunch of work)
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id)); // Xx: findById is async so we need to await it, then async the unnamed function with id
//   // Xx: because of that, guides becomes an array of promises, so we need to await all promises to complete before proceeding
//   this.guides = await Promise.all(guidesPromises); // Xx: override the initial array of IDs from DB with an array of user documents from the await promise all
//   next();
// });

// tourSchema.pre('save', function (next) {
//   console.log('Will save document...');
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE; Xx: find hook makes it query middleware, and not document middleware
// Xx: regular expressions are always (?) between //; the below regex is "all the words that begin with find"; the purpose is to include both find() and findById();
// Xx: if we only set to 'find', it would only be filtered in the get all tours command, but if the person knew the ID, they would be able to access the page directly
tourSchema.pre(/^find/, function (next) {
  // tourSchema.pre('find', function (next) {
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  // Xx: REMEMBER: in query middleware, this always points to the current query
  // Xx: using the code that we had originally implemented in tourController to have it run as a query middleware instead, to avoid repeating code (which would deplete performance)
  // Xx: just added the "this" in the beginning of the original code
  this.populate({ path: 'guides', select: '-__v -passwordChangedAt' });
  next();
});

// AGGREGATION MIDDLEWARE - to remove secret tours from our aggregate objects
// Xx: from Q&A
tourSchema.pre('aggregate', function (next) {
  const matchObject = { $match: { secretTour: { $ne: true } } };
  if (!this.pipeline()[0].$geoNear) this.pipeline().unshift(matchObject);
  else this.pipeline().splice(1, 0, matchObject); // Xx: splice adds/removes/replaces objects in an array; first parameter is the position of the element; 2nd is the number of elements to delete; third is the element to add.
  this.startTime = Date.now(); // Xx: not exactly sure why we set startTime?
  next();
});

// Xx: because the geoNear has to be the first stage in the pipeline, the code below would make match the first stage, so had to change it so that match would not be the first stage if there is a geoNear stage
// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } }); // Xx: unshift adds an element in the beginning of an array; shift adds it to the end of the array
//   next();
// });

// Xx: since it is post query then it has access to all the docs from the query
tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  next();
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
