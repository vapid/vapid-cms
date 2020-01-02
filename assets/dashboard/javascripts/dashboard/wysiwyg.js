/* globals fetch, FormData, Node, document */
const Quill = require('quill');
const { QuillImage, QuillImageBindings } = require('quill-image');
const { QuillHr, QuillHrBindings } = require('quill-hr');

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

  if (res.status !== 'success') { throw new Error(res.message); }
  return res.data.url;
}

class Linebreak extends Break {
  length () { return 1; }
  value () { return '\n'; }

  insertInto(parent, ref) {
    Embed.prototype.insertInto.call(this, parent, ref);
  }
}

Linebreak.blotName = 'linebreak';
Linebreak.tagName = 'BR';

Quill.register(Linebreak);

const options = {
  modules: {
    toolbar: [
      [{ font: [] }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['link', 'blockquote', 'code-block'],
      [{ align: [] }, { list: 'ordered' }, { list: 'bullet' }],
    ],
    clipboard: {
      matchVisual: false,
    },
    keyboard: {
      bindings: {
        ...QuillImageBindings,
        ...QuillHrBindings,
        linebreak: {
          key: 13,
          shiftKey: true,
          handler(range) {
            const currentLeaf = this.quill.getLeaf(range.index)[0];
            const nextLeaf = this.quill.getLeaf(range.index + 1)[0];

            this.quill.insertEmbed(range.index, 'linebreak', true, 'user');

            // Insert a second break if:
            // At the end of the editor, OR next leaf has a different parent (<p>)
            if (nextLeaf === null || (currentLeaf.parent !== nextLeaf.parent)) {
              this.quill.insertEmbed(range.index, 'linebreak', true, 'user');
            }

            // Now that we've inserted a line break, move the cursor forward
            this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
          },
        },
      },
    },
  },
  theme: 'bubble',
};

document.addEventListener('turbolinks:load', () => {
  const editors = document.querySelectorAll('.wysiwyg');

  for (const editor of editors) {
    const _images = editor.getAttribute('data-images') === 'true';

    const quill = new Quill(editor, options);
    const input = editor.nextElementSibling;
    const hrBlot = new QuillHr(quill);
    const imgBlot = new QuillImage(quill, { handler: imageHandler });
    const BlockMenu = editor.previousElementSibling;

    BlockMenu.addEventListener('focusin', () => {
      const range = quill.getSelection(false);
      quill.setSelection(range, 'silent');
    }, true);

    /* eslint-disable no-loop-func */
    BlockMenu.querySelector('.wysiwyg-blocks__block--hr').addEventListener('click', (evt) => {
      hrBlot.insert();
      evt.stopPropagation();
      evt.preventDefault();
      return false;
    });

    BlockMenu.querySelector('.wysiwyg-blocks__block--img').addEventListener('click', (evt) => {
      imgBlot.insert();
      evt.stopPropagation();
      evt.preventDefault();
      return false;
    });

    quill.on('editor-change', () => {
      const range = quill.getSelection(false);
      if (range == null) return true;
      const [blot] = quill.getLine(range.index);
      let showMenu = !blot.domNode.innerText.trim().length;
      if (blot.isBlock) { showMenu = false; }
      BlockMenu.classList.toggle('visible', showMenu);
      if (showMenu) {
        BlockMenu.style.top = `${blot.domNode.getBoundingClientRect().y - editor.getBoundingClientRect().y}px`;
      }
      return true;
    });

    // Paste without text formatting
    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      delta.ops.map((op) => {
        /* eslint-disable no-param-reassign */
        op.attributes = op.attributes || {};
        delete op.attributes.color;
        delete op.attributes.background;
        return op;
        /* eslint-enable no-param-reassign */
      });
      return delta;
    });

    quill.on('text-change', (delta, oldDelta, source) => {
      const content = editor.firstChild.innerHTML
      input.value = content.replace(/^<p><br><\/p>/, '');
    });
  }
});
