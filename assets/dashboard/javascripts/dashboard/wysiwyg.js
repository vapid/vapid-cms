const Quill = require('quill');

const Delta = Quill.import('delta');
const Break = Quill.import('blots/break');
const Embed = Quill.import('blots/embed');

class Linebreak extends Break {
  length () {
    return 1;
  }

  value () {
    return '\n';
  }

  insertInto(parent, ref) {
    Embed.prototype.insertInto.call(this, parent, ref)
  }
}

Linebreak.blotName = 'linebreak';
Linebreak.tagName = 'BR';

Quill.register(Linebreak);

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
    },
    keyboard: {
      bindings: {
        linebreak: {
          key: 13,
          shiftKey: true,
          handler: function (range) {
            let currentLeaf = this.quill.getLeaf(range.index)[0]
            let nextLeaf = this.quill.getLeaf(range.index + 1)[0]

            this.quill.insertEmbed(range.index, 'linebreak', true, 'user');

            // Insert a second break if:
            // At the end of the editor, OR next leaf has a different parent (<p>)
            if (nextLeaf === null || (currentLeaf.parent !== nextLeaf.parent)) {
              this.quill.insertEmbed(range.index, 'linebreak', true, 'user');
            }

            // Now that we've inserted a line break, move the cursor forward
            this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
          }
        },
      },
    },
  },
  theme: 'snow',
};

document.addEventListener("turbolinks:load", () => {
  const editors = document.querySelectorAll('.wysiwyg');

  [].forEach.call(editors, (editor) => {
    options.modules.toolbar[4] = editor.getAttribute('data-images') === "true" ?
      ['image'] : [];

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
