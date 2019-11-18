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

NOTE 3: If you want to have the tool get official steam art when change game art:
1. Run the manager at least once and import any game as a shortcutPath
2. Navigate to `\Users\your_username_here\AppData\Roaming\steamgriddb-manager\` and open the `config` file in any text editor which can handle JSON
3. In a browser, open https://steamcommunity.com/dev/apikey and sign in
4. Copy your API key
5. Add `"steam_api_key":"api_key_you_copied",` after the first open bracket (`{`)

Future versions will add a settings pane which links you to the login and allows you to input it via GUI. App currently does NOT show if official steam art is applied to shortcuts either. Future versions will apply Steam art by default if no custom image is present for shortcuts which have matched steam versions (this will be a toggleable feature in settings).





# License
[MIT](LICENSE.md)
