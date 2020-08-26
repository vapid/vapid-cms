<img src="http://cdn.vapid.com/logo.svg" width="300px" height="auto" alt="Vapid logo">

Vapid is an intentionally simple content management system built on the idea that you can create a custom dashboard without ever leaving the HTML.

[![CircleCI](https://circleci.com/gh/vapid/vapid.svg?style=svg)](https://circleci.com/gh/vapid/vapid)

## Installation

Vapid requires **node v10** or higher, and can be installed via [npm](https://www.npmjs.com/)

```
npm install -g @vapid/cli
```

_Note: A desktop GUI application is coming soon—please add yourself to [the mailing list](https://www.vapid.com) if you'd like to be notified when that is available._

## Usage

To create a new website project, use the Vapid command line tool:

```
vapid new path/to/project/folder
```

Then change to the project directory, and start the development server. By default, the server will livereload, and refresh your website as you change the source files.

```
cd path/to/project/folder
vapid start .
```

A few files and folders you should be aware of:

File/Folder | Description
--- | ---
www | Your website files. Anything you put in here is an accessible resource, with the exceptions of files that start with underscores or periods—those are private/special. Sass and JS files that have the `.pack.js`, `.pack.scss`, or `.pack.sass` extensions will be compiled by Webpack.
data | SQLite database file, and uploaded images. In general, you do not want to mess with this folder.
node_modules | This one should also be ignored.
package.json | Information about your project, including Vapid configuration options.
.env | A private file that contains server environment variables, like the SECRET_KEY used by the web server.

## Deploying

Vapid can be deployed to any hosting service that supports Node.js. Here are a few to consider:

Service | Notes
--- | ---
Heroku | Free or paid tiers. One thing to note is that Heroku's file system is ephemeral, so Vapid's `type=image` directives won't work here.
Glitch | The easiest way to [take Vapid for a test-drive](https://glitch.com/edit/#!/remix/vapid?SECRET_KEY=change-me).

Or, use the `vapid build` command to export to a static website, and host on S3, [Surge](https://surge.sh/), or the like.

## Community

If you'd like to get involved, and help improve Vapid:

* Participate in and answer questions in the [Vapid forums](https://forums.vapid.com/)
* [Contribute](https://github.com/vapid/vapid/blob/master/CONTRIBUTING.md) on [Issues](https://github.com/vapid/vapid/issues)
* Suggest edits for the [Wiki](https://github.com/vapid/vapid/wiki)
* Follow [@hellovapid](https://twitter.com/hellovapid) on Twitter

# License

[MIT](/LICENSE.md)
