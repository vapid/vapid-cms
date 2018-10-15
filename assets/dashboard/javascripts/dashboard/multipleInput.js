document.addEventListener("turbolinks:load", () => {
  const $multiple = $('.multiple-input');
  $multiple.each((i, _this) => {
    $(_this).on('click', '.adder', (e) => {
      const $adder = $(e.target);
      const template = JSON.parse($adder.data('template'));
      $adder.before(template);
    })
  });

  
});
