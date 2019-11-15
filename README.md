# [SteamGridDB Manager](https://www.steamgriddb.com/manager)
SteamGridDB Manager automatically finds games from launchers on your system and imports them into your Steam library with a click of a button.

See the website for download and more information: https://www.steamgriddb.com/manager

# Supported Launchers
SteamGridDB Manager supports importing from the following launchers:
- Origin
- Uplay
- Epic Games Launcher
- Blizzard Battle.net
- GOG.com
- *More coming soon!*

# Building From Source
1. Install the dependencies with `npm install`.
2. Run one of the npm scripts:
   - `npm run run` builds and starts the app.
   - `npm run dist` builds, then outputs an installer into the `dist` directory using electron-builder.

NOTE: I had issues when just trying `npm install`, but the solution for node-gyp issues as listed [here](https://github.com/nodejs/node-gyp/pull/1715#issuecomment-502211967) worked wonders. I'm also using my version of node-steamgriddb directly because the npm install maybe hasn't been updated?

NOTE 2: After `npm install`, remove `node_modules\steamgriddb`, then `git clone https://github.com/steamgriddb/node-steamgriddb.git node_modules\steamgriddb`. PR was merged with master, but npm doesn't fetch new version so we do it manually (I'm new to node package versioning, this is likely an oversight of mine in not updating package.json or something).

# License
[MIT](LICENSE.md)
