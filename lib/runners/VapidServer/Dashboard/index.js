const bodyParser = require('koa-bodyparser');
const multipartParser = require('koa-busboy');
const { parse, resolve, extname } = require('path');
const assert = require('assert');
const passport = require('koa-passport');
const sharp = require('sharp');
const url = require('url');
const views = require('koa-views');
const { readFileSync, writeFileSync } = require('fs');
const animated = require('animated-gif-detector');
const Boom = require('@hapi/boom');
const LocalStrategy = require('passport-local');
const Router = require('koa-router');
const Sequelize = require('sequelize');

const Form = require('../../../form');
const middleware = require('../middleware');
const services = require('../../../services');
const { Paths, Utils } = require('../../../utils');

const router = new Router({ prefix: '/dashboard' });
const paths = Paths.getDashboardPaths();

// TODO: Don't use module globals.
let local;
let Record;
let Section;
let User;
let db;
let uploadsDir;
let siteName;
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
      liveReload,
    } = sharedVars);

    ({ Section, Record, User } = db.models);
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
  ctx.redirect(router.url('sections#show', ctx.state.section.id));
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
    ctx.state.contentSections = await _getContentSections();
    ctx.state.formSections = await Section.scope('forms').findAll({ order: [['name', 'ASC']] });
    ctx.state.showBuild = local;
    ctx.state.needsBuild = db.isDirty;
    await next();
  } else {
    ctx.redirect(router.url('auth#sign_in'));
  }
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
      const matches = url.parse(referer).path.match(/\/dashboard\/(records|sections)\/(\d+)/);
      const models = { records: Record, sections: Section };

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

router.get('sections#show', '/sections/:id', findSection, async (ctx) => {
  // Redirect based on repeat, and if records exist
  const redirectTo = (() => {
    const { section } = ctx.state;

    if (section.records.length === 0) {
      return router.url('records#new', ctx.params.id);
    } else if (section.multiple) {
      return router.url('records#index', section.id);
    }
    return router.url('records#edit', section.records[0].id);
  })();

  ctx.redirect(redirectTo);
});

/*
 * RECORDS
 */

router.get('records#index', '/sections/:id/records', findSection, async (ctx) => {
  const tableAction = ctx.state.section.sortable ? 'draggable' : 'sortable';

  await ctx.render('records/index', ctx.state.section.label, {
    tableAction,
  });
});

router.get('/records/:id', findRecord, async (ctx) => {
  ctx.redirect(router.url('records#edit', ctx.state.record.id));
});

router.get('records#new', '/sections/:id/records/new', findSection, async (ctx) => {
  const { section } = ctx.state;

  if (section.form) {
    const title = `${section.label} Form`;
    const recipient = section.options.recipient || ctx.state.user.email;
    // TODO: Consolidate this logic, which is also in Section module
    const fields = Object.entries(section.fields).reduce((memo, [name, params]) => {
      // Only allow certain directives
      if (params.type && !Section.FORM_ALLOWED_TYPES[params.type]) {
        /* eslint-disable-next-line no-param-reassign */
        delete params.type;
      }

      /* eslint-disable-next-line no-param-reassign */
      memo[name] = params;
      return memo;
    }, {});

    await ctx.render('records/new', title, {
      form: 'email',
      fields,
      action: section.options.action || `https://formspree.io/${recipient}`,
      subject: section.options.subject,
      next: section.options.next,
      submit: section.options.submit,
      Form,
    });
  } else {
    await _newRecordAction(ctx);
  }
});

router.post('records#reorder', '/sections/:id/records/reorder', findSection, async (ctx) => {
  const { id, from, to } = ctx.request.body;
  const record = await Record.findByPk(id, { include: ['section'] });

  await new services.RecordPositionUpdater(record, from, to).perform();
  ctx.status = 200;
});

router.post('records#create', '/sections/:id/records', findSection, async (ctx) => {
  const { section } = ctx.state;
  let record;
  let redirectTo;

  try {
    const content = await _content(ctx);
    record = await Record.build({ content, section_id: section.id });

    // TODO: Can't figure out how to get section to load for validation,
    // so I'm using the record.section = section hack
    record.section = section;
    await record.save();

    // If the section is sortable, append the record
    if (section.sortable) {
      await new services.RecordPositionUpdater(record).perform();
    }

    redirectTo = (() => {
      if (section.multiple) {
        return router.url('records#index', section.id);
      }
      return router.url('records#edit', record.id);
    })();

    ctx.flash('success', `Created ${section.labelSingular}`);
    ctx.redirect(redirectTo);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      ctx.flash('error', 'Please fix the following errors, then resubmit.');
      await _newRecordAction(ctx, err.errors);
    } else {
      throw err;
    }
  }
});

router.get('records#edit', '/records/:id/edit', findRecord, async (ctx) => {
  await _editRecordAction(ctx);
});

router.post('records#update', '/records/:id', findRecord, async (ctx) => {
  try {
    const { record } = ctx.state;
    const { section } = record;
    const content = await _content(ctx);
    const redirectTo = (() => {
      if (section.multiple) {
        return router.url('records#index', section.id);
      }
      return router.url('records#edit', record.id);
    })();

    // If new record is not equal to the old one, update the record in our DB.
    try { assert.deepStrictEqual(record.content, content); } catch (_err) {
      await record.update({ content });
      ctx.flash('success', `Updated ${section.labelSingular}`);
    }

    ctx.redirect(redirectTo);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      ctx.flash('error', 'Please fix the following errors, then resubmit.');
      await _editRecordAction(ctx, err.errors);
    } else {
      throw err;
    }
  }
});

router.get('records#delete', '/records/:id/delete', findRecord, async (ctx) => {
  const title = ctx.state.section.labelSingular;
  await ctx.render('records/delete', `Delete ${title}`);
});

router.post('/records/:id/delete', findRecord, async (ctx) => {
  await ctx.state.record.destroy();
  ctx.flash('success', `Deleted ${ctx.state.section.labelSingular}`);
  ctx.redirect(router.url('records#index', ctx.state.section.id));
});

/*
 * BEFORE ACTIONS
 */

async function defaultSection(ctx, next) {
  const sections = await _getContentSections();
  ctx.state.section = sections[0] || await Section.findGeneral();
  await next();
}

async function findSection(ctx, next) {
  const section = await Section.findByPk(ctx.params.id);

  if (section) {
    // TODO: This seems to be the only way to get the defaultScope/ordering to work
    section.records = await section.getRecords();
    ctx.state.section = section;
    await next();
  } else {
    throw Boom.notFound(`Section #${ctx.params.id} not found`);
  }
}

async function findRecord(ctx, next) {
  const record = await Record.findByPk(ctx.params.id, { include: 'section' });

  if (record) {
    ctx.state.record = record;
    ctx.state.section = record.section;
    await next();
  } else {
    throw Boom.notFound(`Record #${ctx.params.id} not found`);
  }
}

/*
 * PRIVATE METHODS
 */

async function _getContentSections() {
  return Section.scope('content').findAll({
    /*
     * BUG: Postgresql can't compare equality in where clause,
     * so for now we'll just filter the sections after SQL
     *
     * https://github.com/vapid/vapid/issues/149
     */
    // where: {
    //   fields: {
    //     [Sequelize.Op.ne]: {},
    //   },
    // },
    order: [
      [Sequelize.literal(`CASE WHEN name = '${Section.DEFAULT_NAME}' THEN 1 ELSE 0 END`), 'DESC'],
      ['multiple', 'ASC'],
      [Sequelize.cast(Sequelize.json('options.priority'), 'integer'), 'ASC'],
      ['name', 'ASC'],
    ],
  }).then(sections => sections.filter(section => !Utils.isEmpty(section.fields)));
}

async function _newRecordAction(ctx, errors = {}) {
  const title = ctx.state.section.repeating ? `New ${ctx.state.section.labelSingular}` : ctx.state.section.label;
  const record = Utils.isEmpty(ctx.request.body) ? { content: {} } : ctx.request.body;

  await ctx.render('records/new', title, {
    action: router.url('records#create', ctx.state.section.id),
    form: 'content',
    errors: _errors(errors),
    record,
    Form,
  });
}

async function _editRecordAction(ctx, errors = []) {
  const title = ctx.state.record.section.labelSingular;

  await ctx.render('records/edit', title, {
    action: router.url('records#update', ctx.state.record.id),
    deletePath: router.url('records#delete', ctx.state.record.id),
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

  return errors.content || Object.values(errors).join(', ') || {};
}

async function _content(ctx) {
  const { body } = ctx.request;
  const allowedFields = new Set(Object.keys(ctx.state.section.fields));
  const promises = [];

  const content = {};

  // Only make allowed fields available.
  for (const field of allowedFields) {
    content[field] = body.content[field];
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

  return content;
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
