/* global document, window */
const jQuery = require('jquery');
window.$ = window.jQuery = jQuery;

const Turbolinks = require('turbolinks');
Turbolinks.start();

// TODO: Include as packages
require('../vendor/semantic-ui/semantic.min');
require('../vendor/jquery.tablesort');

require('./dashboard/ace');
require('./dashboard/autosave');
require('./dashboard/datepicker');
require('./dashboard/hideMessage');
require('./dashboard/range');
require('./dashboard/semantic');
require('./dashboard/sidebar');
require('./dashboard/sortable');
require('./dashboard/websocket');
require('./dashboard/wysiwyg');

// CSRF
$.ajaxSetup({
  headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
});

/* eslint-disable no-param-reassign */
const autoExpand = (field) => {
  field.style.resize = 'none';
  field.style.height = 'inherit';
  const computed = window.getComputedStyle(field);
  const height = parseInt(computed.getPropertyValue('border-top-width'), 10)
    + parseInt(computed.getPropertyValue('padding-top'), 10)
    + field.scrollHeight
    + parseInt(computed.getPropertyValue('padding-bottom'), 10)
    + parseInt(computed.getPropertyValue('border-bottom-width'), 10);
  field.style.height = `${height}px`;
};
const init = () => [...document.querySelectorAll('textarea')].map(autoExpand);
document.addEventListener('input', (event) => event.target.tagName.toLowerCase() === 'textarea' && autoExpand(event.target), false);
document.addEventListener('turbolinks:load', init);
window.addEventListener('DOMContentLoaded', init);
