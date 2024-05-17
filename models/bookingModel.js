const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Tour',
    required: [true, 'The booking must belong to a Tour!'],
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'The booking must belong to a user!'],
  },
  price: {
    type: Number,
    required: [true, 'The booking must have a price!'],
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  paid: {
    // Xx: just in case we manually create a booking, so we would use this field to control if it was paid or not
    type: Boolean,
    default: true,
  },
});

bookingSchema.pre(/^find/, function (next) {
  this.populate('user').populate({
    path: 'tour',
    select: 'name',
    // Xx: populating both tour and user should not be a problem in terms of performance since only guides and admins would be able to check this DB/send queries, so not a huge impact
  });
  // Xx: all pre middlewares have access to next and we cant forget to call it otherwise the code wont go to the next stage!!
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
