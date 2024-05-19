const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Xx: need to pass in the secret key when requiring stripe
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get the currently booked tour
  const tour = await Tour.findById(req.params.tourId);

  // 2) Create checkout session
  const session = await stripe.checkout.sessions.create({
    // Xx: 'create' will return a promise because setting all the options will basically do an API call to Stripe, so it needs to be awaited, so the whole function should be made async
    payment_method_types: ['card'],
    success_url: `${req.protocol}://${req.get('host')}/my-bookings?alert=success`,
    // success_url: `${req.protocol}://${req.get('host')}/?tour=${req.params.tourId}&user=${req.user.id}&price=${tour.price}`,
    // Xx: when the site is deployed, we would get access to the session object once the purchase is completed using Stripe Webhooks, so that would be perfect to create a booking
    // Xx: since the site is not deployed, we will do an unsafe work around, which is passing the details of the booking as a query in the success_url string, to get the details to create the booking
    // Xx: this is unsafe because anyone who knows the url structure could simply call it without going through the booking LOL free bookings
    // Xx: we need to make a query string because stripe will only make a get request to the success url, so work arounds are limited, cant send a body or any data with it.
    // Xx: including all 3 fields we need for the booking, tour, user and price
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email, // Xx: providing the email address is handy as we already have access to it when the user is logged in; we can save the user one step and make the experience smoother.
    // Xx: protected route, so user is available at req.user
    client_reference_id: req.params.tourId, // Xx: this is a custom field that may be specified optionally; can only really be used when the website is deployed (on an existing domain), but we are setting up anyway
    mode: 'payment',
    // Xx: to create the booking entry in the DB, we will need the user ID, the tour ID and the tour price. we can already get user ID from req.user.email and we will specify price soon, so here we specify tourId
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: tour.price * 100, // Xx: need to multiply by 100 because the price is expected in cents for currencies which have cents
          product_data: {
            name: `${tour.name} Tour`,
            description: tour.summary,
            images: [`${req.protocol}://${req.get('host')}/img/tours/${tour.imageCover}`], // Xx: similar to client_reference_id, can only really be used when the website is deployed (on an existing domain), because Stripe uploads the images to their own database, but specifying anyway
            // Xx: using the images from the natours.dev website publicly available
          },
          // Xx: the field names here are already pre-defined by Stripe, cannot 'invent' new fields, will throw an error
        },
        quantity: 1,
      },
    ],
  });

  // 3) Create session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});

// exports.createBookingCheckout = catchAsync(async (req, res, next) => {
//   // This is only TEMPORARY, because it''s UNSECURE: everyone can make bookkings without paying
//   const { tour, user, price } = req.query; // Xx: query string
//   if (!tour || !user || !price) return next();
//   // Xx: per success_url, we want to create the bookins from the home route ('/'), so we need to point this booking middleware in the viewsrouter the home route
//   await Booking.create({ tour, user, price });

//   res.redirect(req.originalUrl.split('?')[0]);
//   // Xx: originalURL is the entire URL from where the request originally came
// });

// Xx: createBookingCheckout is now a regular function which will accept all the session data from getCheckoutSession
const createBookingCheckout = async (session) => {
  const tour = session.client_reference_id;
  const user = (await User.findOne({ email: session.customer_email }))._id; // Xx: this will bring the object so we wrap everything in () and get its id
  const price = session.amount_total / 100;
  await Booking.create({ tour, user, price });
};

exports.webhookCheckout = (req, res, next) => {
  const signature = req.headers['stripe-signature'];

  // Xx: there could be errors in this event (in the body, in the secret, etc), so wrap it in a try catch block
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET); // Xx: per stripe documentation, need req.body in raw format, signature and checkout secret.
  } catch (err) {
    console.log(err.message);
    return res.status(400);
    // Xx: Jonas returned the error message to the sender saying the sender would be stripe, but I think what if someone tries to send it instead, so prefer to console.log the err.message
  }

  if (event.type === 'checkout.session.completed') {
    createBookingCheckout(event.data.object); // Xx: event type that we defined in the stripe dashbboard when we created the webhook
    res.status(200).json({ received: true }); // Xx: again different from Jonas, only sending "received: true" if checkout.session.complete, but I still think an attacker could simulate this?
  }
};

exports.getAllBookings = factory.getAll(Booking);
exports.getBooking = factory.getOne(Booking);
exports.createBooking = factory.createOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
