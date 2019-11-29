const { join, parse, resolve, extname } = require('path');
const assert = require('assert');
const url = require('url');
const { readFileSync, writeFileSync } = require('fs');

const { deploy, makePublic } = require('@cannery/hoist');
const Boom = require('@hapi/boom');

const bodyParser = require('koa-bodyparser');
const multipartParser = require('koa-busboy');
const passport = require('koa-passport');
const sharp = require('sharp');
const views = require('koa-views');
const animated = require('animated-gif-detector');
const LocalStrategy = require('passport-local');
const Router = require('koa-router');
const Sequelize = require('sequelize');


const Form = require('../../../form');
const services = require('../../../services');
const { Paths, Utils } = require('../../../utils');

const VapidBuilder = require('../../VapidBuilder');

const middleware = require('../middleware');

const router = new Router({ prefix: '/dashboard' });
const paths = Paths.getDashboardPaths();

// TODO: Don't use module globals.
let local;
let Record;
let Template;
let User;
let db;
let uploadsDir;
let siteName;
let sitePaths;
let liveReload;

/**
 * Dashboard
 * Server routes for authenticating, installing, and managing content
 */
class Dashboard {
  /**
   * @param {Object} sharedVars - variables shared by Vapid class
   *
   * @todo Maybe there's a more standard way of sharing with koa-router classes?
   */
  constructor(sharedVars) {
    ({
      local,
      db,
      uploadsDir,
      siteName,
      sitePaths,
      liveReload,
    } = sharedVars);

    ({ Template, Record, User } = db.models);
  }


  /* eslint-disable class-methods-use-this */
  /**
   * Returns routes
   *
   * @return [array] dashboard routes
   */
  get routes() {
    return router.routes();
  }

  /**
   * Paths that are shared with Vapid
   *
   * @return {Object} paths
   *
   * @todo Maybe there's a more standard way of sharing with the koa-router parent?
   */
  get paths() {
    return paths;
  }
  /* eslint-enable class-methods-use-this */
}

module.exports = Dashboard;

/*
 * AUTH
 */

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  const user = await User.findOne({ where: { email } });
  return done(null, user && user.authenticate(password));
}));

/*
 * MIDDLEWARES
 */
router
  .use(middleware.redirect)
  .use(bodyParser())
  .use(multipartParser())
  .use(middleware.flash)
  .use(middleware.csrf)
  .use(passport.initialize())
  .use(passport.session());

router.use(views(paths.views, {
  extension: 'ejs',
  map: {
    html: 'ejs',
  },
}));

// TODO: Remove this hack, and create custom views-like middleware
router.use(async (ctx, next) => {
  // Override ctx.render to accept layouts, and add common locals
  const { render } = ctx;

  ctx.render = async (relPath, title, locals = {}) => {
    const layout = relPath.startsWith('auth/') ? 'auth' : 'default';

    Object.assign(locals, {
      yield: relPath,
      title,
      csrf: ctx.csrf,
      flash: ctx.flash(),
      requestURL: ctx.request.url,
      siteName,
      liveReload,
    });

    await render(`layouts/${layout}`, locals);
  };

  await next();
});

/*
 * ROOT
 */

router.get('root', '/', defaultSection, async (ctx) => {
  ctx.redirect(router.url('sections#index', ctx.state.template.typePlural, ctx.state.template.name));
});

/*
 * INSTALL
 */
router.get('auth#install', '/install', async (ctx) => {
  if (await User.count() > 0) {
    ctx.redirect(router.url('auth#sign_in'));
    return;
  }

  await ctx.render('auth/install', 'Install', {
    email: '',
  });
});

router.post('/install', async (ctx) => {
  if (await User.count() > 0) {
    ctx.redirect(router.url('auth#sign_in'));
    return;
  }

  try {
    const user = await User.create({
      email: ctx.request.body.email,
      password: ctx.request.body.password,
    });
    await ctx.login(user);
    await db.rebuild();
    ctx.redirect(router.url('root'));
  } catch (err) {
    // TODO: Better error messages
    ctx.flash('error', 'Bad email or password');
    await ctx.render('auth/install', 'Install', {
      email: ctx.request.body.email,
    });
  }
});

/*
 * SIGN IN/OUT
 */

router.get('auth#sign_in', '/sign_in', async (ctx) => {
  if (await User.count() === 0) {
    ctx.redirect(router.url('auth#install'));
    return;
  }

  await ctx.render('auth/sign_in', 'Sign In');
});

// TODO: Customize this, so failure repopulates the email address input
router.post('/sign_in', passport.authenticate('local', {
  successRedirect: router.url('root'),
  failureRedirect: router.url('auth#sign_in'),
  failureFlash: 'Invalid email or password',
}));

router.get('auth#sign_out', '/sign_out', async (ctx) => {
  ctx.logout();
  ctx.redirect(router.url('auth#sign_in'));
});

router.use(async (ctx, next) => {
  if (ctx.isAuthenticated()) {
    // For the nav menu
    ctx.state.settings = await Template.scope('settings').findAll({
      order: [
        [Sequelize.literal(`CASE WHEN name = '${Template.DEFAULT_SETTING}' THEN 1 ELSE 0 END`), 'DESC'],
        [Sequelize.cast(Sequelize.json('options.priority'), 'integer'), 'ASC'],
        ['name', 'ASC'],
      ],
    });
    ctx.state.forms = await Template.scope('forms').findAll({ order: [['name', 'ASC']] });

    // Get all page records.
    ctx.state.pages = await Record.getPages();

    ctx.state.collections = await Template.scope('collections').findAll({ order: [['name', 'ASC']] });
    ctx.state.showBuild = local;
    ctx.state.needsBuild = db.isDirty;
    await next();
  } else {
    ctx.redirect(router.url('auth#sign_in'));
  }
});

/*
 * Deploy
 */
router.get('deploy', '/deploy', async (ctx) => {
  const staticBuildPath = join(sitePaths.root, 'dist');
  const builder = new VapidBuilder(sitePaths.root);
  await builder.build(staticBuildPath);
  const siteUrl = await deploy(staticBuildPath);
  await makePublic();
  ctx.redirect(siteUrl);
});

/*
 * BUILD
 */
router.get('build', '/build', async (ctx) => {
  await db.rebuild();

  // TODO: Not nuts about hard-coding paths here
  const redirectTo = await (async () => {
    try {
      const referer = ctx.get('Referrer');
      const matches = url.parse(referer).path.match(/\/dashboard\/(records|templates)\/(\d+)/);
      const models = { records: Record, templates: Template };
      await models[matches[1]].findByPk(matches[2], { rejectOnEmpty: true });
      return 'back';
    } catch (err) {
      return router.url('root');
    }
  })();

  ctx.flash('success', 'Site build complete');
  ctx.redirect(redirectTo, router.url('root'));
});

/*
 * ACCOUNT
 */

router.get('account#edit', '/account/edit', async (ctx) => {
  await _editAccountAction(ctx, ctx.state.user.email);
});

router.post('account#update', '/account', async (ctx) => {
  const { user } = ctx.state;
  const { email, password } = ctx.request.body;

  try {
    await user.update({ email, password });
    ctx.flash('success', 'Updated account info. Please log in again.');
    ctx.redirect(router.url('auth#sign_out'));
  } catch (err) {
    await _editAccountAction(ctx, email, err.errors);
  }
});

/*
 * GROUPS
 */

router.get('sections#pages', '/pages', async (ctx) => {
  // Else, this is a single-record type of template. Render the edit page.
  const templates = await Template.scope('pages').findAll();
  return ctx.render('records/templates', 'New Page', { templates });
});

router.get('sections#page', '/pages/:permalink', findPage, async (ctx) => {
  const { record } = ctx.state;

  // Else, this is a single-record type of template. Render the edit page.
  return _editRecordAction(ctx, record);
});

router.get('sections#index', '/:type/:name', findSection, async (ctx) => {
  const { template } = ctx.state;
  // If there are no records created for this template type yet, render the new record page.
  if (template.records.length === 0) {
    return ctx.redirect(router.url('records#new', template.typePlural, template.name));

  // If this is the type of template that contain multiple records, render the records list page.
  } else if (template.type === 'collection') {
    const tableAction = ctx.state.template.sortable ? 'draggable' : 'sortable';
    return ctx.render('records/index', ctx.state.template.label, {
      tableAction,
    });
  }

  // Else, this is a single-record type of template. Render the edit page.
  return _editRecordAction(ctx, template.records[0]);
});

/*
 * RECORDS
 */

router.get('records#new', '/:type/:name/records/new', findSection, async (ctx) => {
  const { template } = ctx.state;
  if (template.type === 'form') {
    const title = `${template.labelSingular} Form`;
    const recipient = template.options.recipient || ctx.state.user.email;
    // TODO: Consolidate this logic, which is also in Template module
    const fields = Object.entries(template.fields).reduce((memo, [name, params]) => {
      // Only allow certain directives
      if (params.type && !Template.FORM_ALLOWED_TYPES[params.type]) {
        /* eslint-disable-next-line no-param-reassign */
        delete params.type;
      }

      /* eslint-disable-next-line no-param-reassign */
      memo[name] = params;
      return memo;
    }, {});

    await _newRecordAction(ctx, {
      title: `${template.labelSingular} Form`,
      isNewRecord: true,
      template,
      fields,
      action: template.options.action || `https://formspree.io/${recipient}`,
      subject: template.options.subject,
      next: template.options.next,
      submit: template.options.submit,
      Form,
    });
  } else {
    await _newRecordAction(ctx);
  }
});

router.get('collection#view', '/:type/:name/records/:id', findRecord, async (ctx) => {
  return _editRecordAction(ctx, ctx.state.record);
});

router.post('records#reorder', '/records/reorder', async (ctx) => {
  const { id, from, to, nav } = ctx.request.body;
  const record = await Record.findByPk(id);
  await new services.RecordPositionUpdater(record, from, to, nav).perform(db);
  ctx.status = 200;
});

router.post('records#create', '/:type/:name/records', findSection, async (ctx) => {
  const { template } = ctx.state;
  let record;

  try {
    const { content, metadata } = await _content(ctx);
    record = await Record.build({ content, metadata, template_id: template.id });
    record.template = template;
    ctx.state.record = record;
    await record.save();

    // If the template is sortable, append the record
    if (template.sortable) {
      await new services.RecordPositionUpdater(record).perform();
    }

    ctx.flash('success', `Created ${record.nameSingular}`);
    const name = template.type === 'page' ? record.safeSlug : template.name;
    return ctx.redirect(router.url('sections#index', template.typePlural, name));
  } catch (err) {
    console.error(err);
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
      ctx.flash('error', 'Please fix the following errors, then resubmit.');
      await _newRecordAction(ctx, {}, err.errors);
    } else {
      throw err;
    }
  }
});

router.post('records#update', '/:type/:name/records/:id', findRecord, async (ctx) => {
  const { record } = ctx.state;
  try {
    const { template } = record;
    const { content, metadata } = await _content(ctx);

    // If new record is not equal to the old one, update the record in our DB.
    try {
      assert.deepStrictEqual(record.content, content);
      assert.deepStrictEqual(record.metadata, metadata);
    } catch (_err) {
      console.log('content', content);
      await record.update({ content, metadata });
      ctx.flash('success', `Updated ${record.nameSingular}`);
    }

    if (template.type !== 'page') {
      ctx.redirect(router.url('sections#index', template.typePlural, template.name));
    } else {
      ctx.redirect(router.url('sections#index', template.typePlural, record.safeSlug));
    }
  } catch (err) {
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
      ctx.flash('error', 'Please fix the following errors, then resubmit.');
      await _editRecordAction(ctx, record, err.errors);
    } else {
      throw err;
    }
  }
});

router.post('image#upload', '/upload', async (ctx) => {
  if (ctx.request.files.length > 1) {
    ctx.status = 400;
    ctx.body = {
      status: 'error',
      message: 'One file at a time.',
    };
    return;
  }

  const fileUrl = await _saveFile(ctx.request.files[0]);
  ctx.status = 400;
  ctx.body = {
    status: 'success',
    data: { url: `/uploads/${fileUrl}` },
  };
});

router.get('records#delete', '/:type/:name/records/:id/delete', findRecord, async (ctx) => {
  const title = ctx.state.template.labelSingular;
  await ctx.render('records/delete', `Delete ${title}`);
});

router.post('/:type/:name/records/:id/delete', findRecord, async (ctx) => {
  await ctx.state.record.destroy();
  ctx.flash('success', `Deleted ${ctx.state.record.nameSingular}`);
  if (ctx.state.template.type === 'page') {
    ctx.redirect('/dashboard');
  } else {
    ctx.redirect(router.url('sections#index', ctx.state.template.typePlural, ctx.state.template.name));
  }
});

/*
 * BEFORE ACTIONS
 */
async function defaultSection(ctx, next) {
  ctx.state.template = await Template.findIndex() || await Template.findGeneral();
  await next();
}

async function findPage(ctx, next) {
  const { permalink } = ctx.params;
  const [name, id] = permalink.split('-');
  const template = await Template.findOne({ where: { type: 'page', name } });
  const record = await Record.findOne({ where: { slug: permalink }, include: ['template'] });

  if (record) {
    ctx.state.template = record.template;
    ctx.state.record = record;
    await next();
  } else if (template) {
    // TODO: This seems to be the only way to get the defaultScope/ordering to work
    const where = id ? { where: { id } } : {};
    template.records = await template.getRecords(where);
    ctx.state.template = template;
    ctx.state.record = template.records[0];
    await next();
  } else {
    throw Boom.notFound(`Template ${ctx.params.type}:${ctx.params.name} not found`);
  }
}

async function findSection(ctx, next) {
  const type = Utils.singularize(ctx.params.type);
  const { name } = ctx.params;
  const template = await Template.findOne({ where: { type, name } });

  if (template) {
    // TODO: This seems to be the only way to get the defaultScope/ordering to work
    template.records = await template.getRecords({ order: [['position', 'ASC']]});
    ctx.state.template = template;
    await next();
  } else {
    throw Boom.notFound(`Template ${ctx.params.type}:${ctx.params.name} not found`);
  }
}

async function findRecord(ctx, next) {
  const record = await Record.findByPk(ctx.params.id, { include: 'template' });

  if (record) {
    ctx.state.record = record;
    ctx.state.template = record.template;
    await next();
  } else {
    throw Boom.notFound(`Record ${ctx.params.type}:${ctx.params.name}:${ctx.params.id} not found`);
  }
}

async function _newRecordAction(ctx, options = {}, errors = {}) {
  const { body } = ctx.request;
  let { template, record } = ctx.state;
  record = record || await Record.build({
    content: body.content || {},
    metadata: body.metadata || {},
    template_id: template.id,
  });
  record.template = template;
  const nextId = ((await db.sequelize.query('SELECT max(id) as id FROM records'))[0][0].id || -1) + 1;
  record.id = record.id || nextId;
  const title = options.title || template.type === 'setting'
    ? template.labelSingular
    : `New ${template.labelSingular} ${template.type === 'page' ? 'Page' : ''}`;
  await ctx.render('records/edit', title, {
    isNewRecord: true,
    template,
    record,
    action: router.url('records#create', template.typePlural, template.name),
    errors: _errors(errors),
    Form,
    ...options,
  });
}

async function _editRecordAction(ctx, record = {}, errors = []) {
  const { template } = ctx.state;
  await ctx.render('records/edit', template.type === 'page' ? record.name : record.nameSingular, {
    isNewRecord: false,
    template,
    record,
    action: router.url('records#update', template.typePlural, template.name, record.id || '0'),
    deletePath: router.url('records#delete', template.typePlural, template.name, record.id || '0'),
    errors: _errors(errors),
    Form,
  });
}

async function _editAccountAction(ctx, email, errors = []) {
  if (!Utils.isEmpty(errors)) {
    ctx.flash('error', _errors(errors));
  }

  await ctx.render('account/edit', 'Edit Account Info', {
    section: {},
    action: router.url('account#update'),
    email,
  });
}

function _errors(errorObjects = []) {
  const errorItems = Array.isArray(errorObjects) ? errorObjects : [errorObjects];
  const errors = errorItems.reduce((memo, item) => {
    const value = ((str) => {
      try {
        return JSON.parse(str);
      } catch (err) {
        return str;
      }
    })(item.message);

    /* eslint-disable-next-line no-param-reassign */
    memo[item.path] = value;
    return memo;
  }, {});

  return errors;
}

async function _content(ctx) {
  const metadataFields = ['name', 'slug'];
  const { body } = ctx.request;
  const allowedFields = new Set(Object.keys(ctx.state.template.fields));
  const promises = [];

  const content = {};
  // Only make allowed fields available.
  for (const field of allowedFields) {
    content[field] = body.content[field];
  }

  const metadata = ctx.state.record ? Object.assign({}, ctx.state.record.metadata || {}) : {};
  body.metadata = body.metadata || {};

  // Only make allowed fields available.
  for (const field of metadataFields) {
    metadata[field] = body.metadata[field] || null;
  }

  // Pre-processing the slug here instead of just in the SQL hook helps with database cache busting.
  if (metadata.slug) {
    metadata.slug = metadata.slug.replace(/^\/+/, '');
  }

  // Save files
  for (const file of ctx.request.files) {
    const fieldName = file.fieldname.match(/content\[(.*)\]/)[1];
    if (allowedFields.has(fieldName)) {
      promises.push(_saveFile(file).then((c) => { content[fieldName] = c; }));
    }
  }

  await Promise.all(promises);

  // Process destroys
  for (const fieldName of Object.keys(body._destroy || {})) {
    delete content[fieldName];
  }

  return { content, metadata };
}

async function _saveFile(file) {
  const fileName = _fileDigest(file);
  const savePath = resolve(uploadsDir, fileName);
  const buffer = readFileSync(file.path);

  // Sharp can't output SVG or animated GIF
  if (animated(buffer) || extname(file.path) === '.svg') {
    writeFileSync(savePath, buffer, { encoding: 'binary' });
  } else {
    // Ensures that EXIF rotated images are oriented correctly
    await sharp(buffer)
      .rotate()
      .toFile(savePath);
  }

  return fileName;
}

function _fileDigest(file) {
  const checksum = Utils.checksum(file.path);
  const { name, ext } = parse(file.filename);

  return `${Utils.snakeCase(name)}-${checksum}${ext}`;
}
