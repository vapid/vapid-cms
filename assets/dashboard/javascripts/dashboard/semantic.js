/* globals document, $ */
document.addEventListener("turbolinks:load", () => {
  // Semantic UI
  $('.ui.checkbox').checkbox();
  $('.ui.dropdown').dropdown();
  $('.ui.sortable.table').tablesort();
});

document.addEventListener("turbolinks:load", () => {
  $(document.body).on('keyup', '.ui.dropdown.custom', (evt) => {
    if (evt.keyCode !== 13) { return; }
    const { target } = evt;
    const { value } = target;
    const select = evt.target.parentElement.querySelector('select');
    const op = document.createElement('option');
    op.innerText = value;
    op.setAttribute('value', value);
    op.setAttribute('selected', true);
    select.insertBefore(op, select.firstChild);
    target.value = '';
    select.value = value;
    $(select).dropdown();
  });
});
