const Registry = window.require('winreg');
const Store = window.require('electron-store');
const fs = window.require('fs');
const {join} = window.require('path');
const VDF = window.require('@node-steam/vdf');
const shortcut = window.require('steam-shortcut-editor');
const https = window.require('https');
const Stream = window.require('stream').Transform;
const metrohash64 = window.require('metrohash').metrohash64;
const log = window.require('electron-log');
import SteamID from 'steamid';
import {crc32} from 'crc';
const SteamAPI = window.require('steamapi');
const SGDB = window.require('steamgriddb');


const steamAPI = new SteamAPI(process.env.STEAM_API_KEY);

class Steam {
    constructor() {
        this.steamPath = null;
        this.loggedInUser = null;
        this.currentUserGridPath = null;
    }

    //  steam does not currently store icons in appid*.ext format
    static art_type_suffix = {
      library: 'p',
      bigpicture: '',
      hero: '_hero',
      logo: '_logo',
    }

    // used for specifying alternate default steam source base on arttypes
    static steam_server_remap = {
      library: 'library2x',
      bigpicture: 'bigpicture',
      hero: 'hero',
      logo: 'logo',
      thumb: 'small'
    }

    // will eventually add settings to remap arttypes to server filenames
    static steam_server_filenames = {
      small: 'capsule_231x87.jpg',
      library: 'library_600x900.jpg',
      library2x: 'library_600x900_2x.jpg',
      bigpicture: 'header.jpg', // used in big picture
      background: 'page.bg.jpg',
      hero: 'library_hero.jpg', // used in library detail page
      logo: 'logo.png',
      gen_background: 'page_bg_generated.jpg',
      gen_background6: 'page_bg_generated_v6b.jpg' // used on store page
    }



    static getSteamDatabase(){
      return new Promise((resolve, reject) => {
        steamAPI.getAppList().then((response) => {
          let appdict = response.reduce((obj, item)=>{
            obj[item.name] = item.appid;
            return obj;
          },{});
          this.steamidLookup = appdict;
          log.info('Successfully connected to the Steam database. Storing database locally.');
          resolve(appdict);
        })
        .catch((err)=>{
          log.info('There was an error connecting to the Steam database.');
          reject(err);
        });
      });
    }

    // stormy
    // change this to run once on startup, then save to variable for further use
    // setting frequency of updating steam database should be a configurable setting
    // will also allow user to refresh it manually
    // part of a bigger package involving fuzzy game name lookups
    // storing db this way as part of 'config' seems incredibly stupid, but it works for now
    // should probably change to an fs file save or something
    static getSteamAppLookup(){
      return new Promise((resolve, reject) => {
        const store = new Store();
        const currentdate = new Date();
        const DAYS_IN_MILLISECONDS = 1000 * 60 * 60 * 24;
        let updatefreq = 3 * DAYS_IN_MILLISECONDS;
        if (store.has('steamdb')) {
          log.info('cached steamdb')
          updatefreq = store.get('steamdb.update_frequency');
          const db_lastupdate = new Date(store.get('steamdb.lastupdated'));
          const diff = currentdate.getTime() - db_lastupdate.getTime();
          if (diff < updatefreq){
            log.info(`Steam DB updated fewer than ${updatefreq / DAYS_IN_MILLISECONDS} days ago, using local version`);
            return resolve(store.get('steamdb.database'))
          }
        }
        this.getSteamDatabase().then((appdict)=>{
          store.set({
            steamdb: {
              lastupdated: currentdate,
              update_frequency: updatefreq,
              database: appdict
            }
          });
          return resolve(appdict);
        }).catch((err)=>{
          return reject(err);
        });
      });
    }

    // Unclear on whether this method is needed
    // Makes a nice loggable dict of appname:steamid for shortcuts
    static getSteamIdsFromShortcuts(names) {
      return new Promise((resolve, reject) => {
        return this.getSteamAppLookup().then((appdict) => {
          let steamidmap =  names.reduce((obj,name)=>{
            if(appdict[name]){
              obj[name] = appdict[name];
            }
            return obj;
          },{});
          log.info(`Found Steam entries for ${Object.keys(steamidmap).length} shortcuts:`)
          log.info(Object.keys(steamidmap));
          return resolve(steamidmap);
        }).catch(log.error);
      });
    }


    static getSteamPath() {
        return new Promise((resolve, reject) => {
            if (this.steamPath) {
                return resolve(this.steamPath);
            }

            // We're on a mac, use mac path
            let steamPath = false;
            if(process.platform == 'darwin'){
              steamPath = `/Users/${process.env.USER}/Library/Application\ Support/Steam`;
            }

            // We're on a pc, search registry
            else if (process.platform == 'win32'){
              const key = new Registry({
                  hive: Registry.HKCU,
                  key:  '\\Software\\Valve\\Steam'
              });

              key.values((err, items) => {
                  items.forEach((item) => {
                      if (item.name === 'SteamPath') {
                          steamPath = item.value;
                      }
                  });
              });
            }

            if (steamPath) {
                this.steamPath = steamPath;
                log.info(`Got Steam path: ${steamPath}`);
                resolve(steamPath);
            } else {
                reject(new Error('Could not find Steam path.'));
            }
        });
    }

    static getCurrentUserGridPath() {
          return new Promise((resolve) => {
              if (this.currentUserGridPath) {
                  return resolve(this.currentUserGridPath);
              }
              this.getSteamPath().then((steamPath) => {
                  this.getLoggedInUser().then((user) => {
                      const gridPath = join(steamPath, 'userdata', String(user), 'config', 'grid');
                      if (!fs.existsSync(gridPath)){
                          fs.mkdirSync(gridPath);
                      }
                      this.currentUserGridPath = gridPath;
                      resolve(gridPath);
                  });
              });
          });
    }

    static getSteamGames() {

        return new Promise((resolve) => {
            this.getSteamPath().then((steamPath) => {
                this.getCurrentUserGridPath().then((userdataPath) => {
                    const parsedLibFolders = VDF.parse(fs.readFileSync(join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf-8'));
                    const games = [];
                    const libraries = [];

                    // Add Steam install dir
                    libraries.push(steamPath);

                    // Add library folders from libraryfolders.vdf
                    Object.keys(parsedLibFolders.LibraryFolders).forEach((key) => {
                        const library = parsedLibFolders.LibraryFolders[key];
                        if (!isNaN(key)) {
                            libraries.push(library);
                        }
                    });

                    log.info(`Found ${libraries.length} Steam libraries:`);

                    libraries.forEach((library) => {
                        const appsPath = join(library, 'steamapps');
                        log.info(`Library at ${appsPath}`);
                        const files = fs.readdirSync(appsPath);
                        // fails if steam has not been run since a removable drive library was disconnected
                        files.forEach((file) => {
                            const ext = file.split('.').pop();

                            if (ext === 'acf') {
                                const filePath = join(appsPath, file);
                                const data = fs.readFileSync(filePath, 'utf-8');
                                try {
                                  const gameData = VDF.parse(data);

                                  // which game is this?
                                  if (gameData.AppState.appid === 228980) {
                                      return;
                                  }

                                  let default_images = this.getDefaultGridImages(gameData.AppState.appid);
                                  let custom_images = this.getCustomGridImages(userdataPath, gameData.AppState.appid);
                                  let images = {};
                                  Object.keys(this.art_type_suffix).forEach((key)=>{
                                    images[key] = custom_images[key] ? custom_images[key] : default_images[key];
                                  });

                                  games.push({
                                    appid: gameData.AppState.appid,
                                    name: gameData.AppState.name,
                                    library_image: images['library'],
                                    bigpicture_image: images['bigpicture'],
                                    logo_image: images['logo'],
                                    hero_image: images['hero'],
                                    type: 'game'
                                  });
                              } catch(err) {
                                  log.warn(`Error while parsing ${file}: ${err}`);
                                  return;
                              }
                            }
                        });
                    });
                    log.info(`Fetched ${games.length} Steam games:`);
                    log.info(games.map(x=>x.name));
                    resolve(games);
                });
            });
        });
    }

    static getOwnedGamesByApi() {
      return new Promise((resolve, reject) => {
        this.getSteamPath().then((steamPath) => {
          this.getCurrentUserGridPath().then((userdataPath) => {
            this.getLoggedInUser().then((user) => {

            steamAPI.getUserOwnedGames((new SteamID(parseInt(user,10)))).then((response) => {
                log.info(user);
                log.info('user');
                const games = response.map(game => {
                  let default_images = this.getDefaultGridImages(game.appid);
                  let custom_images = this.getCustomGridImages(userdataPath, game.appid);
                  let images = {};
                  Object.keys(this.art_type_suffix).forEach((key) => {
                    images[key] = custom_images[key] ? custom_images[key] : default_images[key];
                  });
                  return {
                    appid: game.appid,
                    name: game.name,
                    library_image: images['library'],
                    bigpicture_image: images['bigpicture'],
                    logo_image: images['logo'],
                    hero_image: images['hero'],
                    type: 'game'
                  };
                });
                resolve(games);
              })
              .catch((err) => {
                log.info('There was an error connecting to the Steam database.');
                reject(err);
              });
            });
          });
        });
      });
    }



    // get steam games by registry entries; seems to get all platform steam games?
    static getOwnedSteamGames() {
        const client = new SGDB(process.env.STEAMGRIDDB_API_KEY);
        return new Promise((resolve) => {
            this.getSteamPath().then((steamPath) => {
                this.getCurrentUserGridPath().then((userdataPath) => {
                    const parsedLibFolders = VDF.parse(fs.readFileSync(join(steamPath, 'registry.vdf'), 'utf-8'));
                    const gamepromises = [];

                    // Add library folders from libraryfolders.vdf
                    Object.keys(parsedLibFolders.Registry.HKCU.Software.Valve.Steam.apps).forEach((steamid,i) => {
                        let game = client.getGameBySteamAppId(steamid).then(game=>{
                          let default_images = this.getDefaultGridImages(steamid);
                          let custom_images = this.getCustomGridImages(userdataPath, steamid);
                          let images = {};
                          Object.keys(this.art_type_suffix).forEach((key)=>{
                            images[key] = custom_images[key] ? custom_images[key] : default_images[key];
                          });
                          return {
                              appid: steamid,
                              name: game.name,
                              library_image: images['library'],
                              bigpicture_image: images['bigpicture'],
                              logo_image: images['logo'],
                              hero_image: images['hero'],
                              type: 'game'
                          };
                        }).catch(err=>{
                          //log.error(`${err} for steamid ${steamid}`);
                        });
                        gamepromises.push(game );
                    });
                    Promise.all(gamepromises).then(games=>{
                      games = games.filter(game => game != null);
                       log.info(`Fetched ${games.length} Steam games:`);
                       //log.info(games.map(x=>x.name));
                       resolve(games);
                    }).catch(log.error);
                });
            });
        });
    }

    static getNonSteamGames() {
        return new Promise((resolve) => {
            this.getSteamPath().then((steamPath) => {
                this.getLoggedInUser().then((user) => {
                    const store = new Store();
                    const userdataPath = join(steamPath, 'userdata', String(user));
                    const userdataGridPath = join(userdataPath, 'config', 'grid');
                    const shortcutPath = join(userdataPath, 'config', 'shortcuts.vdf');
                    shortcut.parseFile(shortcutPath, (err, items) => {
                        const games = {};

                        if (!items) {
                            return resolve([]);
                        }
                        let appnames = items.shortcuts.map(x => x.AppName || x.appname);
                        log.info(`Found ${items.shortcuts.length} shortcuts`);
                        //log.info(appnames);
                        this.getSteamIdsFromShortcuts(appnames).then((lookup)=>{
                          items.shortcuts.forEach((item) => {
                              const appName = item.appname || item.AppName;
                              const exe = item.exe || item.Exe;
                              const appid = this.generateAppId(exe, appName);
                              const steamid = lookup[appName] || undefined;

                              let custom_images = this.getCustomGridImages(userdataGridPath, appid, true);
                              let using_custom = Object.keys(custom_images).reduce((acc, key)=>{
                                acc[key] = !!custom_images[key];
                                return acc;
                              },{});
                              let images = custom_images;
                              if(steamid){
                                let default_images = this.getDefaultGridImages(steamid);
                                Object.keys(this.art_type_suffix).forEach((key)=>{
                                  images[key] = custom_images[key] ? custom_images[key] : default_images[key];
                                });
                              }

                              const configId = metrohash64(exe+item.LaunchOptions);
                              if (store.has(`games.${configId}`)) {
                                  const storedGame = store.get(`games.${configId}`);
                                  if (typeof games[storedGame.platform] == 'undefined') {
                                      games[storedGame.platform] = [];
                                  }
                                  games[storedGame.platform].push({
                                      gameId: storedGame.id,
                                      appid: appid,
                                      steamid: steamid,
                                      name: appName,
                                      platform: storedGame.platform,
                                      library_image: images['library'],
                                      bigpicture_image: images['bigpicture'],
                                      logo_image: images['logo'],
                                      hero_image: images['hero'],
                                      using_custom: using_custom,
                                      type: 'shortcut'
                                  });
                              }
                              else {
                                  if (!games['other']) {
                                      games['other'] = [];
                                  }
                                  games['other'].push({
                                      gameId: null,
                                      appid: appid,
                                      steamid: steamid,
                                      name: appName,
                                      platform: 'other',
                                      library_image: images['library'],
                                      bigpicture_image: images['bigpicture'],
                                      logo_image: images['logo'],
                                      hero_image: images['hero'],
                                      using_custom: using_custom,
                                      type: 'shortcut'
                                  });
                              }
                          });
                          resolve(games);
                        });

                    });
                });
            });
        });
    }

    //
    static generateLongAppId(exe, name) {
      const key = exe + name;
      const top = BigInt(crc32(key)) | BigInt(0x80000000);
      const bigint = BigInt(top) << BigInt(32) | BigInt(0x02000000);
      const str = String(bigint);
      return str;
    }

    static generateAppId(exe, name) {
        const key = exe + name;
        const top = BigInt(crc32(key)) | BigInt(0x80000000);
        const bigint = BigInt(top) << BigInt(32) | BigInt(0x02000000);
        const shift = bigint >> BigInt(32);
        const str = String(shift);
        return String(shift);
    }

    static shortenShortcutId(appid){
      return String(BigInt(appid) >> BigInt(32));
    }

    static lengthenShortcutId(appid){
      return String((BigInt(appid) << BigInt(32)) | BigInt(0x02000000));
    }

    static getLoggedInUser() {
        return new Promise((resolve) => {
            if (this.loggedInUser) {
                return resolve(this.loggedInUser);
            }

            this.getSteamPath().then((steamPath) => {
                const loginusersPath = join(steamPath, 'config', 'loginusers.vdf');
                const data = fs.readFileSync(loginusersPath, 'utf-8');
                const loginusersData = VDF.parse(data);

                for (const user in loginusersData.users) {
                    log.info('parsing login users');
                    if (loginusersData.users[user].mostrecent) {
                        const accountid = (new SteamID(user)).accountid;
                        this.loggedInUser = accountid;
                        log.info(`Got Steam user: ${accountid}`);
                        return resolve(accountid);
                    }
                }
            });
        });
    }

    // get steamid from game name, then get steam data
    static getDefaultGridImage(steamid, arttype) {
      arttype = this.steam_server_remap[arttype];
      return `https://steamcdn-a.akamaihd.net/steam/apps/${steamid}/${this.steam_server_filenames[arttype]}`;
    }

    static getDefaultGridImages(steamid) {
      let images = {};
      Object.keys(this.art_type_suffix).forEach((key)=>{
        images[key] = this.getDefaultGridImage(steamid, key);
      });
      return images;
    }

    static getCustomGridImage(userdataGridPath, appid, arttype, is_shortcut = false) {
        const fileTypes = ['jpg', 'jpeg', 'png', 'tga', 'apng'];
        const basePath = join(userdataGridPath, String(is_shortcut && arttype == 'bigpicture' ? this.lengthenShortcutId(appid) : appid));
        const suffixPath = basePath.concat(String(this.art_type_suffix[arttype]));

        let image = false;
        fileTypes.some((ext) => {
            const path = `${suffixPath}.${ext}`;
            if (fs.existsSync(path)) {
                image = path;
                return true;
            }
        });
        return image;
    }

    static getCustomGridImages(userdataGridPath, appid, is_shortcut = false) {
        let images = {};
        Object.keys(this.art_type_suffix).forEach((key)=>{
          images[key] = this.getCustomGridImage(userdataGridPath, appid, key, is_shortcut);
        });
        return images;
    }

    static deleteCustomGridImage(userdataGridPath, appid, arttype, is_shortcut = false) {
        const imagePath = this.getCustomGridImage(userdataGridPath, appid, arttype, is_shortcut);
        if (imagePath) {
            fs.unlinkSync(imagePath);
        }
    }

    static getShortcutFile() {
        return new Promise((resolve) => {
            this.getSteamPath().then((steamPath) => {
                this.getLoggedInUser().then((user) => {
                    const userdataPath = join(steamPath, 'userdata', String(user));
                    const shortcutPath = join(userdataPath, 'config', 'shortcuts.vdf');
                    resolve(shortcutPath);
                });
            });
        });
    }

    static addGrid(appId, gameType, url, arttype, onProgress = () => {}) {
        let is_shortcut = (gameType == 'shortcut');
        return new Promise((resolve, reject) => {
            this.getCurrentUserGridPath().then((userGridPath) => {
                const image_url = url;
                const image_ext = image_url.substr(image_url.lastIndexOf('.') + 1);
                let gameid = (gameType == 'shortcut' && arttype == 'bigpicture')? this.lengthenShortcutId(appId) : appId;
                const dest = join(userGridPath, `${gameid}${this.art_type_suffix[arttype]}.${image_ext}`);

                let cur = 0;
                const data = new Stream();
                let progress = 0;
                let lastProgress = 0;
                https.get(url, (response) => {
                    const len = parseInt(response.headers['content-length'], 10);

                    response.on('end', () => {
                        this.deleteCustomGridImage(userGridPath, appId, arttype, is_shortcut);
                        fs.writeFileSync(dest, data.read());
                        resolve(dest);
                    });

                    response.on('data', (chunk) => {
                        cur += chunk.length;
                        data.push(chunk);
                        progress = Math.round((cur / len) * 10) / 10;
                        if (progress !== lastProgress) {
                            lastProgress = progress;
                            onProgress(progress);
                        }
                    });
                }).on('error', (err) => {
                    fs.unlink(dest);
                    reject(err);
                });
            });
        });
    }

    static addShortcuts(shortcuts) {
        return new Promise((resolve) => {
            this.getShortcutFile().then((shortcutPath) => {
                shortcut.parseFile(shortcutPath, (err, items) => {
                    const newShorcuts = {
                        'shortcuts': []
                    };

                    let apps = [];
                    if (typeof items != 'undefined') {
                        apps = items.shortcuts;
                    }

                    shortcuts.forEach((value) => {
                        // Don't add dupes
                        for (let i = 0; i < apps.length; i++) {
                            const app = apps[i];
                            const appid = this.generateAppId(app.exe, app.appname);
                            if (this.generateAppId(value.exe, value.name) === appid) {
                                return resolve();
                            }
                        }

                        apps.push({
                            'appname': value.name,
                            'exe': value.exe,
                            'StartDir': value.startIn,
                            'LaunchOptions': value.params,
                            'icon': (typeof value.icon !== 'undefined' ? value.icon : ''),
                            'IsHidden': false,
                            'ShortcutPath': '',
                            'AllowDesktopConfig': true,
                            'OpenVR': false,
                            'tags': (typeof value.tags !== 'undefined' ? value.tags : [])
                        });
                    });

                    newShorcuts.shortcuts = apps;

                    shortcut.writeFile(shortcutPath, newShorcuts, () => resolve());
                });
            });
        });
    }

    static removeShortcut(name, executable) {
        return new Promise((resolve) => {
            this.getShortcutFile().then((shortcutPath) => {
                shortcut.parseFile(shortcutPath, (err, items) => {
                    const newShorcuts = {
                        'shortcuts': []
                    };

                    let apps = [];
                    if (typeof items != 'undefined') {
                        apps = items.shortcuts;
                    }

                    for (let i = 0; i < apps.length; i++) {
                        const app = apps[i];
                        const appid = this.generateAppId(app.exe, app.appname);
                        if (this.generateAppId(executable, name) === appid) {
                            apps.splice(i, 1);
                            break;
                        }
                    }

                    newShorcuts.shortcuts = apps;
                    shortcut.writeFile(shortcutPath, newShorcuts, () => resolve());
                });
            });
        });
    }
}

export default Steam;
