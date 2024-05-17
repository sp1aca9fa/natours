/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const login = async (email, password) => {
  // Xx: only modern browsers accept async functions so should be careful about compatibility when using it
  try {
    // alert(email, password);
    // Xx: as a test, create an alert window with email and pw typed in; alert does not show correctly 2 objects, maybe console log is better

    // Xx: axios is the module responsible to send the calls from front to back
    const res = await axios({
      method: 'POST',
      url: 'http://127.0.0.1:3000/api/v1/users/login',
      data: {
        email, // Xx: frontend is sending an email property and backend is also expecting an email property, so leaving it as just email works
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully!');
      window.setTimeout(() => {
        location.assign('/');
      }, 1500); // Xx: send the user to the home page after 1.5s
    }
  } catch (err) {
    showAlert('error', err.response.data.message); // Xx: err.response.data comes from Axious documentation; it displays the error reports from server in the client console
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: 'http://127.0.0.1:3000/api/v1/users/logout',
    });
    // Xx: reload the page so the user does not see the page as logged in even tho they logged out
    // Xx: test if the received data is success
    if (res.data.status === 'success') location.reload(true); // Xx: the true is really important otherwise it would reload from cash and would still have the logged in page
  } catch (err) {
    // Xx: usually there wouldnt be any errors when logging out, but just in case, for example, in case there is no connection
    showAlert('error', 'Error logging out! Try again.');
  }
};
