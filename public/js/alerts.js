/* eslint-disable */

// Xx: this is the slide down html alerts when you log in
// Xx: it's mostly js and html manipulation, so I dont understand a lot

export const hideAlert = () => {
  const el = document.querySelector('.alert');
  if (el) el.parentElement.removeChild(el);
};

// type is 'success or 'error'
export const showAlert = (type, msg, time = 7) => {
  // Xx: if we dont specify, the time will be 7 * 1000 miliseconds = 7 seconds
  hideAlert();
  const markup = `<div class="alert alert--${type}">${msg}</div>`;
  document.querySelector('body').insertAdjacentHTML('afterbegin', markup);
  window.setTimeout(hideAlert, time * 1000);
};
