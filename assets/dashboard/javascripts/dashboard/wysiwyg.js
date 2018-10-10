const Quill = require('quill');

const options = {
  modules: {
    toolbar: [
      [{ header: [2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['link', 'blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
    ],
    clipboard: {
      matchVisual: false,
    }
  },
  theme: 'snow',
};

document.addEventListener("turbolinks:load", () => {
  const editors = document.querySelectorAll('.wysiwyg');

  [].forEach.call(editors, (editor) => {
    const quill = new Quill(editor, options);
    const input = editor.nextElementSibling;

    quill.on('text-change', (delta, oldDelta, source) => {
      const content = editor.firstChild.innerHTML
      input.value = content.replace(/^<p><br><\/p>/, '');
    });

    editor.addEventListener('click', (e) => {
      if (editor === e.target) {
        quill.setSelection(quill.getLength());
      }
    }, false);
  });
});