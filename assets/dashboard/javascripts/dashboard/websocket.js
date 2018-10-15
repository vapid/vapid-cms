const liveReload = document.querySelector('meta[name=livereload]');

if ('WebSocket' in window && liveReload) {
  const ws = new WebSocket(`ws://${location.host}/livereload`);

  document.addEventListener("turbolinks:load", () => {
    const $build = $('.build.button');
    const $view = $('.view.button');

    ws.onmessage = (evt) => {
      const { command } = JSON.parse(evt.data);
      const isDirty = command === 'dirty';

      if (isDirty) {
        $('.ui.flash').remove();
      }

      $build.toggleClass('hidden', !isDirty);
      $view.toggleClass('hidden', isDirty);
    };
  });
}
