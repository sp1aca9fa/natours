/* eslint-disable */
import '@babel/polyfill';
import { displayMap } from './leaflet';
// const displayMap = require('./leaflet'); // Xx: this is the way to 'require' when working on JS Xx: testing multiple times what would make leaflet stop giving unexpected import errors; solution was to include "type='module' " when importing the script in tour.pug
import { login, logout } from './login';
import { updateSettings } from './updateSettings';
import { showAlert } from './alerts';
import { bookTour } from './stripe';

// DOM ELEMENTS Xx: except leaflet
const loginForm = document.querySelector('.form--login');
const logoutBtn = document.querySelector('.nav__el--logout');
const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour'); // Xx: ID of button.btn.btn--green.span-all-rows#book-tour(data-tour-id=`${tour.id}`) Book tour now! in tour.pug

// LEAFLET
const leafLet = document.getElementById('map');
if (leafLet) {
  document.addEventListener('DOMContentLoaded', function () {
    const locations = JSON.parse(document.getElementById('map').dataset.locations);
    displayMap(locations);
  });
}

if (loginForm)
  loginForm.addEventListener('submit', (e) => {
    // Xx: querySelector is used to select based on the class, then we pass the selector name
    // Xx: addEventListener to listen to when forms are submitted
    // Xx: in the callback function we will have access to the event, so e
    e.preventDefault();
    // Xx: preventDefault is to prevent the form from submitting in standard html method
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    // Xx: getting e-mail and password from the form
    login(email, password);
  });

if (logoutBtn) logoutBtn.addEventListener('click', logout);

if (userDataForm) {
  userDataForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(); // Xx: basically recreating the form-data from what we would need to change in the html code to upload files, enctype='multipart/form-data' (see comment in account.pug)
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]); // Xx: files is an array; since there is only one, we select the first element
    // const name = document.getElementById('name').value;
    // const email = document.getElementById('email').value;
    // Xx: commented out the first implementation of the code, before adding photo upload functionalityy
    // updateSettings({ name, email }, 'data')
    updateSettings(form, 'data'); // Xx: axious will recognize the form as an object and work the same as before
  });
}

if (userPasswordForm) {
  userPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--save-password').textContent = 'Updating...';
    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    await updateSettings({ passwordCurrent, password, passwordConfirm }, 'password');
    document.querySelector('.btn--save-password').textContent = 'Change password';
    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
    // Xx: clean up the password fields after updating password, though it might not be needed since Im refreshing the page
  });
}

if (bookBtn)
  bookBtn.addEventListener('click', (e) => {
    e.target.textContent = 'Processing...'; // Xx: changes the text off the button once the event listener listens (on click)
    // Xx: e is event
    // const tourId = e.target.dataset.tourId; // Xx: event.target is basically the element that was clicked, the one that triggered this eventlistener, and we have the tourID
    const { tourId } = e.target.dataset; // Xx: since tourId is the same on both sides we can use destructuring
    // Xx: the data-tour-id from button.btn.btn--green.span-all-rows#book-tour(data-tour-id=`${tour.id}`) Book tour now! in the tour.pug will automatically convert to tourId
    // Xx: anything coming after data- will convert like that (data-tour-id becomes tourId)
    bookTour(tourId); // Xx: with this the tourId should get passed into the url to be used in the call by axios which in turn should return a checkout session
  });

//- Xx: (data-alert=`${alert ? alert : ''}`) if there is an alert use the alert; otherwise display nothing;
//- Xx: this is the first step to allow displaying the booking successful alert.
//- Xx: then we will include an alert keyword in the query string
//- Xx: then we will have a middleware which will take that keyword from the url and will put an alert message on response.locals
//- Xx: finally we will then implement it in index.js
const alertMessage = document.querySelector('body').dataset.alert;
if (alert) showAlert('success', alertMessage);
