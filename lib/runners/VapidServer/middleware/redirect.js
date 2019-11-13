/**
 * Custom redirect method
 * Necessary for Turbolinks
 *
 * @return {function} middleware
 */

module.exports = async (ctx, next) => {
  // Override ctx.render
  const { redirect } = ctx;

  ctx.redirect = (url, alt) => {
    ctx.set('Turbolinks-Location', url);
    redirect.apply(ctx, [url, alt]);
  };

  await next();
};
