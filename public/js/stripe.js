/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

// Xx: general process to implement on website:
// Xx: started editing tour.pug to receive the tour ID and editted some html elements
// Xx: added the stripe api script to the tour.pug
// Xx: step 1 (below) of this stripe.js, include public key and get method with axios
// Xx: include btn element in index.js and include the event handler based on that button

export const bookTour = async (tourId) => {
  const stripe = Stripe(
    'pk_test_51PG0r7ELunyUxCByvmwaLcuqIjDu0iocPF2RvcYqKFtnIzUs8LoDQsysQOb72hWGsdgckKVCAqqGswOh67a1OQfh00gznvQBmC',
  );
  try {
    // 1) get checkout session from API
    const session = await axios(`http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`);
    // Xx: since it's a simple GET method, we can write it this way
    console.log(session);

    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
      // Xx: axios res is in session
      // Xx: axios creates a data object, so session.id is inside that data object
      // Xx: to test the payment in the stripe checkout session in test mode, cc no is 4242 4242 4242 4242 (...)
      // Xx: valid through can be any future date; CVC can be any 3 digitis, name can be anything, country can be anything and hit pay :)
      // Xx: goes to the success url after finishing payment
      // Xx: after the payment is successful, users also received an email from stripe automatically (unless we deactivate it)
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
