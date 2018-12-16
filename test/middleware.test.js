const crypto = require('crypto');
const supertest = require('supertest');
const Koa = require('koa');
const tmp = require('tmp');
const { existsSync, statSync } = require('fs');
const { join, resolve } = require('path');
const imageSize = require('image-size');
const middleware = require('../lib/middleware');
const Utils = require('../lib/utils');

let app;
let server;
let request;

beforeEach((done) => {
  app = new Koa();
  server = app.listen(done);
  request = supertest.agent(server);
});

afterEach((done) => {
  server.close(done);
});

/**
 * ASSETS
 */
describe('assets', () => {
  test.skip();
});

/**
 * FAVICON
 */
describe('favicon', () => {
  test.skip();
});

/**
 * IMAGE PROCESSING
 */
describe('image processing', () => {
  const tmpDir = tmp.dirSync().name;
  const paths = {
    cache: tmpDir,
    www: resolve(__dirname, 'fixtures/site/www'),
  };

  beforeEach(() => {
    app.use(middleware.imageProcessing(paths));
  });

  afterAll(() => {
    Utils.removeFiles(tmpDir);
  });

  // TODO: Is there a better way to test next() being called than 404?
  it('only processes JPG/PNG/WEBP with a width/height param', (done) => {
    request.get('/images/test.jpg')
      .expect(404, done);

    request.get('/images/test.gif')
      .expect(404, done);

    ['jpg', 'png', 'webp'].forEach((ext) => {
      request.get(`/images/test.${ext}?w=400`)
        .expect(200, done);
    });
  });

  it('resizes images that have width or height set', (done) => {
    request.get('/images/test.jpg?w=400')
      .expect('Content-Type', 'image/jpeg')
      .then((response) => {
        const dimensions = imageSize(response.body);
        expect(dimensions.width).toEqual(400);
        expect(dimensions.height).toEqual(300);
      })
      .then(done);

    request.get('/images/test.png?h=150')
      .expect('Content-Type', 'image/png')
      .then((response) => {
        const dimensions = imageSize(response.body);
        expect(dimensions.width).toEqual(200);
        expect(dimensions.height).toEqual(150);
      })
      .then(done);
  });

  it('crops images that have width and height set', (done) => {
    request.get('/images/test.webp?w=200&h=200')
      .expect('Content-Type', 'image/webp')
      .then((response) => {
        const dimensions = imageSize(response.body);
        expect(dimensions.width).toEqual(200);
        expect(dimensions.height).toEqual(200);
      })
      .then(done);
  });

  it('caches resized images', (done) => {
    const url = '/images/test.jpg?w=600';
    request.get(url)
      .then(() => {
        const filePath = join(paths.www, url.split('?')[0]);
        const fileStats = statSync(filePath);
        const cacheKey = crypto.createHash('md5')
          .update(`${url}${fileStats.mtime}`)
          .digest('hex');
        const cachePath = join(paths.cache, `${cacheKey}.jpg`);
        expect(existsSync(cachePath)).toBeTruthy();
        done();
      });
  });
});

/**
 * LOGS
 */
describe('logs', () => {
  test.skip();
});

/**
 * PRIVATE FILES
 */
describe('privateFiles', () => {
  it('passes normal paths', (done) => {
    app.use(middleware.privateFiles)
      .use((ctx) => {
        ctx.body = '';
      });

    request.get('/test')
      .expect(200, done);
  });

  it('404 when paths starts with an underscore', (done) => {
    app
      .use(async (ctx, next) => {
        try {
          await next();
        } catch (err) {
          expect(err.output.statusCode).toEqual(404);
          expect(err.output.payload.message).toMatchSnapshot();
        }
      })
      .use(middleware.privateFiles);

    request.get('/_test')
      .end(done);
  });

  it('404 when paths starts with a period', (done) => {
    app
      .use(async (ctx, next) => {
        try {
          await next();
        } catch (err) {
          expect(err.output.statusCode).toEqual(404);
          expect(err.output.payload.message).toMatchSnapshot();
        }
      })
      .use(middleware.privateFiles);

    request.get('/.test')
      .end(done);
  });
});

/**
 * SECURITY
 * Reduntant koa-helmet test, but included in case this middleware
 * is updated down the road.
 */
describe('security', () => {
  it('uses the default helmet config', (done) => {
    app.use(middleware.security);

    request.get('/')
      .expect('X-DNS-Prefetch-Control', 'off')
      .expect('X-Frame-Options', 'SAMEORIGIN')
      .expect('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
      .expect('X-Download-Options', 'noopen')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('X-XSS-Protection', '1; mode=block')
      .end(done);
  });
});

/**
 * SESSION
 */
describe('session', () => {
  it('sets the vapid:sess as the key', (done) => {
    app.keys = ['secret'];
    app.use(middleware.session(app))
      .use((ctx) => {
        ctx.session.test = 'test';
      });

    request.get('/')
      .expect('Set-Cookie', /vapid:sess/)
      .end(done);
  });
});

/**
 * WEBPACK
 */
describe('webpack', () => {
  test.skip();
});
