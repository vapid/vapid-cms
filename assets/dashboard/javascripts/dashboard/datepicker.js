const flatpickr = require('flatpickr');
const dateFormat = 'F j, Y'
const timeFormat = 'h:i K'

document.addEventListener("turbolinks:load", () => {
  // Dates
  flatpickr('[type=date]', {
    altFormat: dateFormat,
    altInput: true,
  });

  // Dates w/ time
  flatpickr('[type=datetime-local]', {
    altFormat: `${dateFormat} at ${timeFormat}`,
    altInput: true,
    enableTime: true
  });
});
