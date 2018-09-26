const sortable = require('../../vendor/html5sortable');

document.addEventListener("turbolinks:load", () => {
  const $el = $('.draggable.table tbody');

  if ($el.length) {
    sortable($el, {
      forcePlaceholderSize: true,
    });

    $el[0].addEventListener('sortupdate', (e) => {
      const { item } = e.detail;
      const { index: from } = e.detail.origin;
      const { index: to } = e.detail.destination;
      const id = item.getAttribute('data-id');

      $.post('./records/reorder', { id, from, to }).fail((err) => {
        // TODO: probably need some better client-side error handling here
        alert('Error: could not reorder records');
      });
    });
  }
});
