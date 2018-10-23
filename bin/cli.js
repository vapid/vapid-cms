#!/usr/bin/env node
const program = require('commander');
const inquirer = require('inquirer');
const updateNotifier = require('update-notifier');

const pkg = require('../package.json');
const services = require('../lib/services');
const Deployer = require('../lib/deployer');
const Generator = require('../lib/generator');
const Logger = require('../lib/logger');
const Vapid = require('../lib/vapid');

function withVapid(command) {
  return async (target) => {
    try {
      const cwd = target instanceof program.Command ? process.cwd() : target;
      const vapid = new Vapid(cwd);

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
      `View your website at http://localhost:${vapid.config.port}`,
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
  .action(withVapid(async (vapid) => {
    const deployer = new Deployer(vapid.paths);
    let deployContent = false;
    let answers;

    if (!deployer.loggedIn) {
      Logger.info('Please enter your Vapid credentials, or visit vapid.com to signup.');
      answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
        },

        {
          type: 'password',
          name: 'password',
          message: 'Password:',
        },
      ]);

      await deployer.login(answers.email, answers.password);
    }

    if (!deployer.hasSite) {
      answers = await inquirer.prompt({
        type: 'confirm',
        name: 'newSite',
        message: 'Is this a new website?',
      });


      if (!answers.newSite) {
        Logger.extra([
          'Please add your site\'s ID to package.json.',
          // TODO: See vapid.com/blah-blah for more info
        ]);
      }

      answers = await inquirer.prompt({
        type: 'confirm',
        name: 'deployContent',
        message: 'Would you like to deploy the existing content too?',
      });

      ({ deployContent } = answers);
    }

    Logger.info('Deploying your website...');

    // TODO: Need Deployer to be more isolated, so it isn't aware of Section
    // and remove the need to connect to the DB
    vapid.db.connect();
    await deployer.deploy(vapid.builder.tree, vapid.db.models.Section, deployContent);

    // TODO: Not sure why this is necessary
    process.exit(0);
  }));

/**
 * version - prints the current Vapid version number
 */
program
  .version(`Vapid ${pkg.version}`, '-v, --version');

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
