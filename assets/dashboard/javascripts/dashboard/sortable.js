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

      $.post('/dashboard/records/reorder', { id, from, to }).fail((err) => {
        // TODO: probably need some better client-side error handling here
        alert('Error: could not reorder records');
      });
    });
  }
});

document.addEventListener("turbolinks:load", () => {
  const $el = $('.menu.sortable');

  if ($el.length) {
    sortable($el, {
      forcePlaceholderSize: false,
      items: 'a',
      placeholder: '<a class="item" style="height: 37px"></a>',
    });

    $el[0].addEventListener('sortupdate', (e) => {
      const { item } = e.detail;
      const id = item.getAttribute('data-id');
      const { index: from } = e.detail.origin;
      const { index: to } = e.detail.destination;

      // Check if this element is a nav item.
      let nav = false;
      for (const el of item.parentElement.children) {
        if (el.tagName.toLowerCase() === 'hr') { break; }
        if (el === item) { nav = true; }
      }
      // If this is not a nav item, correct for the extra element in the sorting container.
      // if (!nav) { to -= 1; }

      $.post('/dashboard/records/reorder', { id, from, to, nav }).fail((err) => {
        // TODO: probably need some better client-side error handling here
        alert('Error: could not reorder records');
      });
    });
  }
});
