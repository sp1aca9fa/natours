/* eslint-disable */
// import { L } from '../lib/leaflet';
export const displayMap = (locations) => {
  // const displayMap = (locations) => { // Xx: this is the way to 'require' when working on JS Xx: testing multiple times what would make leaflet stop giving unexpected import errors; solution was to include "type='module' " when importing the script in tour.pug
  // Xx: from Q&A by Hiroshi, had to troubleshoot the remaining issues
  // document.addEventListener('DOMContentLoaded', function () {
  //   let locations;
  //   if (document.getElementById('map')) {
  //     locations = JSON.parse(document.getElementById('map').dataset.locations);
  //     console.log('locations: ', locations);
  // Xx: the location data is stored in dataset.locations because it is called data-locations
  // Xx: using leaflet.js instead of mapbox as suggested in the course

  // Xx: from https://github.com/Leaflet/Leaflet/issues/3962 by Dipinrajc April 26, 2018
  var container = L.DomUtil.get('map');
  if (container != null) {
    container._leaflet_id = null;
  }

  // Xx: from Q&A, using leaflet instead of mapbox
  var map = map != null ? map : L.map('map', { zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const points = [];
  locations.forEach((loc) => {
    points.push([loc.coordinates[1], loc.coordinates[0]]);
    L.marker([loc.coordinates[1], loc.coordinates[0]])
      .addTo(map)
      .bindPopup(`<p>Day ${loc.day}: ${loc.description}</p>`, {
        autoClose: false,
      })
      .openPopup();
  });

  const bounds = L.latLngBounds(points).pad(0.5);
  map.fitBounds(bounds);

  map.scrollWheelZoom.disable();
};

// module.exports = displayMap; // Xx: this is the way to 'require' when working on JS Xx: testing multiple times what would make leaflet stop giving unexpected import errors; solution was to include "type='module' " when importing the script in tour.pug// Xx: this is the way to 'require' when working on JS Xx: testing multiple times what would make leaflet stop giving unexpected import errors; solution was to include "type='module' " when importing the script in tour.pug
//   });
// };
