const Quill = require('quill');

const options = {
  modules: {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['link', 'blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
    ],
  },
  theme: 'snow',
};

document.addEventListener("turbolinks:load", () => {
  const editors = document.querySelectorAll('.wysiwyg');

  [].forEach.call(editors, (editor) => {
    const quill = new Quill(editor, options);
    const input = editor.nextElementSibling;

    quill.on('text-change', (delta, oldDelta, source) => {
      input.value = editor.firstChild.innerHTML;
    });
  });
});