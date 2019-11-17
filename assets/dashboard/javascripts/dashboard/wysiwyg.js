/* globals fetch, FormData, Node, document */
const Quill = require('quill');
const { QuillImage, QuillImageBindings } = require('quill-image');

Quill.register('modules/quillImage', QuillImage);

const Break = Quill.import('blots/break');
const Embed = Quill.import('blots/embed');

async function imageHandler(_quill, id, b64Image, type = 'image/png') {

  // base64 to blob
  const blob = await fetch(b64Image).then(res => res.blob());

  const filename = [id, '.', type.match(/^image\/(\w+)$/i)[1]].join('');

  // generate a form data
  const formData = new FormData();
  formData.set('file', blob, filename);
  formData.set('_csrf', document.getElementsByName('_csrf')[0].value);

  const res = await fetch('/dashboard/upload', {
    method: 'POST',
    body: formData,
  }).then(r => r.json());
  console.log(res);

  if (res.status !== 'success') { throw new Error(res.message); }
  return res.data.url;
}

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
    quillImage: {
      handler: imageHandler
    },
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
        ...QuillImageBindings,
        linebreak: {
          key: 13,
          shiftKey: true,
          handler(range) {
            const currentLeaf = this.quill.getLeaf(range.index)[0]
            const nextLeaf = this.quill.getLeaf(range.index + 1)[0]

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
  theme: 'bubble',
};

document.addEventListener("turbolinks:load", () => {
  const editors = document.querySelectorAll('.wysiwyg');

  [].forEach.call(editors, (editor) => {
    options.modules.toolbar[4] = editor.getAttribute('data-images') === 'true' ?
      ['image'] : [];

    const quill = new Quill(editor, options);
    const input = editor.nextElementSibling;

    // Paste without text formatting
    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      delta.ops.map((op) => {
        op.attributes = op.attributes || {};
        delete op.attributes.color;
        delete op.attributes.background;
      });
      return delta;
    })

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
