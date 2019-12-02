#!/usr/bin/env node
const path = require('path');

const program = require('commander');
const updateNotifier = require('update-notifier');

const pkg = require('../package.json');
const services = require('../lib/services');
const Generator = require('../lib/generator');
const { Logger } = require('../lib/utils');
const VapidServer = require('../lib/runners/VapidServer');
const VapidBuilder = require('../lib/runners/VapidBuilder');
const VapidDeployer = require('../lib/runners/VapidDeployer');

function withVapid(command) {
  return async (target) => {
    try {
      const cwd = target instanceof program.Command ? process.cwd() : target;
      const vapid = new VapidServer(cwd);

      updateNotifier({ pkg }).notify({ isGlobal: true });
      await command(vapid);
    } catch (err) {
      // TODO: Deployer throws err.message, handle better
      const message = err.response && err.response.body ? err.response.body.message : err.message;
      Logger.error(message);
      process.exit(1);
    }
  };
}

/**
 * new - copies the generator files to target directory
 *
 * @param {string} target
 */
program
  .command('new <target>')
  .description('create a new website')
  .action((target) => {
    Generator.copyTo(target);

    Logger.info('Site created.');
    Logger.extra([
      'To start the server now, run:',
      `  vapid start ${target}`,
    ]);
  });

/**
 * start - runs the web server
 *
 * @param {string} [target='.']
 */
program
  .command('start')
  .description('start the server')
  .action(withVapid(async (vapid) => {
    const portInUse = await new services.PortChecker(vapid.config.port).perform();

    if (portInUse) {
      throw new Error(`Could not start server, port ${vapid.config.port} is already in use.`);
    }

    Logger.info(`Starting the ${vapid.env} server...`);
    await vapid.start();
    Logger.extra([
      `View your website at ${vapid.url}`,
      'Ctrl + C to quit',
    ]);
  }));

/**
 * deploy - publishes the website to the hosting platform
 *
 * @param {string} [target='.']
 */
program
  .command('deploy')
  .description('deploy to Vapid\'s hosting service')
  .action(async (target) => {
    const cwd = typeof target !== 'string' ? process.cwd() : target;
    const vapid = new VapidDeployer(cwd);
    await vapid.deploy();
    process.exit(0);
  });

/**
 * version - prints the current Vapid version number
 */
program
  .version(`Vapid ${pkg.version}`, '-v, --version');

/**
 * version - prints the current Vapid version number
 */
program
  .command('build')
  .description('generate a static build of the site')
  .action(async (target, dest) => {
    const cwd = typeof target !== 'string' ? process.cwd() : target;
    const destDir = typeof dist !== 'string' ? path.join(process.cwd(), 'dist') : dest;
    const vapid = new VapidBuilder(cwd);
    await vapid.build(destDir);
    process.exit(0);
  });

/**
 * catch all command - shows the help text
 */
program
  .command('*', { noHelp: true })
  .action(() => {
    Logger.error(`Command "${process.argv[2]}" not found.`);
    program.help();
  });

/**
 * Read args, or show help
 */
if (process.argv.slice(2).length) {
  program.parse(process.argv);
} else {
  program.help();
}
