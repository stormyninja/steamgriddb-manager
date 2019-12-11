import SteamID from 'steamid';
import { crc32 } from 'crc';

const Registry = window.require('winreg');
const Store = window.require('electron-store');
const fs = window.require('fs');
const { join, extname } = window.require('path');
const VDF = window.require('@node-steam/vdf');
const shortcut = window.require('steam-shortcut-editor');
const https = window.require('https');
const Stream = window.require('stream').Transform;
const { metrohash64 } = window.require('metrohash');
const log = window.require('electron-log');
const Categories = window.require('steam-categories');
const glob = window.require('glob');

//Stormyninja's imports
const SteamAPI = window.require('steamapi');
const SGDB = window.require('steamgriddb');


class Steam {
  constructor() {
    this.steamPath = null;
    this.loggedInUser = null;
    this.currentUserGridPath = null;
  }

  static getSteamPath() {
    return new Promise((resolve, reject) => {
      if (this.steamPath) {
        return resolve(this.steamPath);
      }

      const key = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Valve\\Steam',
      });

      key.values((err, items) => {
        let steamPath = false;

        items.forEach((item) => {
          if (item.name === 'SteamPath') {
            steamPath = item.value;
          }
        });

        if (steamPath) {
          this.steamPath = steamPath;
          log.info(`Got Steam path: ${steamPath}`);
          return resolve(steamPath);
        }

        return reject(new Error('Could not find Steam path.'));
      });

      return false;
    });
  }

  static image_extensions = ['jpg', 'jpeg', 'png', 'tga', 'apng'];

  //  steam does not currently store icons in appid*.ext format
  static art_type_suffix = {
    verticalGrid: 'p',
    horizontalGrid: '',
    hero: '_hero',
    logo: '_logo',
  }

  // used for specifying alternate default steam source base on arttypes
  static steam_server_remap = {
    verticalGrid: 'library',
    horizontalGrid: 'header',
    hero: 'hero',
    logo: 'logo',
    thumb: 'small'
  }

  // will eventually add settings to remap arttypes to server filenames
  static steam_server_filenames = {
    small: 'capsule_231x87.jpg',
    library: 'library_600x900.jpg',
    library2x: 'library_600x900_2x.jpg',
    header: 'header.jpg', // used in big picture
    background: 'page.bg.jpg',
    hero: 'library_hero.jpg', // used in library detail page
    logo: 'logo.png',
    gen_background: 'page_bg_generated.jpg',
    gen_background6: 'page_bg_generated_v6b.jpg' // used on store page
  }

static getSteamDatabase(){
  return new Promise((resolve, reject) => {
    const store = new Store();
    if (store.has('steam_api_key')){
      const steamAPI = new SteamAPI(store.get('steam_api_key'));
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
    }
    else {
      reject('No Steam API key');
    }


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
      log.error(err);
      return resolve({});
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
      log.info(`Found Steam entries for ${Object.keys(steamidmap).length} shortcuts`)
      // log.info(Object.keys(steamidmap));
      return resolve(steamidmap);
    }).catch(log.error);
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
          if (!fs.existsSync(gridPath)) {
            fs.mkdirSync(gridPath);
          }
          this.currentUserGridPath = gridPath;
          resolve(gridPath);
        });
      });
      return false;
    });
  }

  static getSteamGames() {
    return new Promise((resolve) => {
      this.getSteamPath().then((steamPath) => {
        const parsedLibFolders = VDF.parse(fs.readFileSync(join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf-8'));
        const games = [];
        const libraries = [];

        // Add Steam install dir
        libraries.push(steamPath);

        // Add library folders from libraryfolders.vdf
        Object.keys(parsedLibFolders.LibraryFolders).forEach((key) => {
          const library = parsedLibFolders.LibraryFolders[key];
          if (!Number.isNaN(parseInt(key, 10))) {
            libraries.push(library);
          }
        });

        log.info(`Found ${libraries.length} Steam libraries`);

        libraries.forEach((library) => {
          const appsPath = join(library, 'steamapps');
          const files = fs.readdirSync(appsPath);
          files.forEach((file) => {
            const ext = file.split('.').pop();

            if (ext === 'acf') {
              const filePath = join(appsPath, file);
              const data = fs.readFileSync(filePath, 'utf-8');
              try {
                const gameData = VDF.parse(data);
                if (gameData.AppState.appid === 228980) {
                  return;
                }

                games.push({
                  appid: gameData.AppState.appid,
                  name: gameData.AppState.name,
                  type: 'game',
                });
              } catch (err) {
                log.warn(`Error while parsing ${file}: ${err}`);
              }
            }
          });
        });
        log.info(`Fetched ${games.length} Steam games`);

        resolve(games);
      });
    });
  }

  static getNonSteamGames() {
    return new Promise((resolve) => {
      this.getSteamPath().then((steamPath) => {
        this.getLoggedInUser().then((user) => {
          const store = new Store();
          const userdataPath = join(steamPath, 'userdata', String(user));
          const shortcutPath = join(userdataPath, 'config', 'shortcuts.vdf');
          const processed = [];
          shortcut.parseFile(shortcutPath, (err, items) => {
            const games = {};

            if (!items) {
              return resolve([]);
            }

            let appnames = items.shortcuts.map(x => x.AppName || x.appname || x.appName);
            log.info(`Found ${items.shortcuts.length} shortcuts`);
            this.getSteamIdsFromShortcuts(appnames).then((lookup)=>{
              items.shortcuts.forEach((item) => {
              const appName = item.appname || item.AppName || item.appName;
              const exe = item.exe || item.Exe;
              const appid = this.generateNewAppId(exe, appName);
              const steamid = lookup[appName] || undefined;

              const configId = metrohash64(exe + item.LaunchOptions);
              if (store.has(`games.${configId}`)) {
                const storedGame = store.get(`games.${configId}`);
                if (typeof games[storedGame.platform] === 'undefined') {
                  games[storedGame.platform] = [];
                }

                if (!processed.includes(configId)) {
                  games[storedGame.platform].push({
                    gameId: storedGame.id,
                    steamId: steamid,
                    name: appName,
                    platform: storedGame.platform,
                    type: 'shortcut',
                    appid,
                  });
                  processed.push(configId);
                }
              } else {
                if (!games.other) {
                  games.other = [];
                }

                games.other.push({
                  gameId: null,
                  steamId: steamid,
                  name: appName,
                  platform: 'other',
                  type: 'shortcut',
                  appid,
                });
              }
            });
            return resolve(games);
          });
          });
        });
      });
    });
  }


  /* eslint-disable no-bitwise, no-mixed-operators */
  static generateAppId(exe, name) {
    const key = exe + name;
    const top = BigInt(crc32(key)) | BigInt(0x80000000);
    return String((BigInt(top) << BigInt(32) | BigInt(0x02000000)));
  }

  // Appid for new library.
  // Thanks to https://gist.github.com/stormyninja/6295d5e6c1c9c19ab0ce46d546e6d0b1 & https://gitlab.com/avalonparton/grid-beautification
  static generateNewAppId(exe, name) {
    const key = exe + name;
    const top = BigInt(crc32(key)) | BigInt(0x80000000);
    const shift = (BigInt(top) << BigInt(32) | BigInt(0x02000000)) >> BigInt(32);
    return parseInt(shift, 10);
  }
  /* eslint-enable no-bitwise, no-mixed-operators */

  static getLoggedInUser() {
    return new Promise((resolve) => {
      if (this.loggedInUser) {
        return resolve(this.loggedInUser);
      }

      this.getSteamPath().then((steamPath) => {
        const loginusersPath = join(steamPath, 'config', 'loginusers.vdf');
        const data = fs.readFileSync(loginusersPath, 'utf-8');
        const loginusersData = VDF.parse(data);

        Object.keys(loginusersData.users).every((user) => {
          if (loginusersData.users[user].MostRecent || loginusersData.users[user].mostrecent) {
            const { accountid } = (new SteamID(user));
            this.loggedInUser = accountid;
            log.info(`Got Steam user: ${accountid}`);
            resolve(accountid);
            return true;
          }
          return false;
        });
      });
      return false;
    });
  }

  static getDefaultImage(appid) {
    https://steamcdn-a.akamaihd.net/steam/apps/
    return `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;
  }

  static getCachedImage(type, librarycachePath, appid) {
    const filename = this.steam_server_filenames[this.steam_server_remap[type]];
    const image = join(librarycachePath, `${appid}_${filename}`);
    return fs.existsSync(image) ? image : false;
  }

  static getCachedImages(librarycachePath, appid) {
    let images = {};
    Object.keys(this.art_type_suffix).forEach((key)=>{
      images[key] = this.getCachedImage(key, librarycachePath, appid);
    });
    return images;
  }

  static getServerImage(type, appid) {
    const steamserverPath = 'https://steamcdn-a.akamaihd.net/steam/apps/'
    const filename = this.steam_server_filenames[this.steam_server_remap[type]];
    const image = join(steamserverPath, String(appid), filename);
    return image;
  }

  static getServerImages(appid) {
    let images = {};
    Object.keys(this.art_type_suffix).forEach((key)=>{
      images[key] = this.getServerImage(key, appid);
    });
    return images;
  }

  static getCustomImage(type, userdataGridPath, appid) {
      const fileTypes = this.image_extensions;
      const suffix = this.art_type_suffix[type];
      const basePath = join(userdataGridPath, `${appid}${suffix}`);

      let image = false;
      fileTypes.some((ext) => {
        const path = `${basePath}.${ext}`;
        if (fs.existsSync(path)) {
          image = path;
          return true;
        }
      });
      return image;
  }

  static getCustomImages(userdataGridPath, appid) {
      let images = {};
      Object.keys(this.art_type_suffix).forEach((key)=>{
        images[key] = this.getCustomImage(key, userdataGridPath, appid);
      });
      return images;
  }

  static shortenShortcutId(appid){
    return String(BigInt(appid) >> BigInt(32));
  }

  static lengthenShortcutId(appid){
    return String((BigInt(appid) << BigInt(32)) | BigInt(0x02000000));
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

  static addAsset(type, appId, url) {
    return new Promise((resolve, reject) => {
      this.getCurrentUserGridPath().then((userGridPath) => {
        const imageUrl = url;
        const imageExt = extname(imageUrl);

        log.info(imageExt);
        const dest = join(userGridPath, `${appId}${this.art_type_suffix[type]}${imageExt}`);
        const noext = dest.replace(imageExt, '');

        log.info('dest');
        log.info(dest);
        let cur = 0;
        const data = new Stream();
        let progress = 0;
        let lastProgress = 0;
        https.get(url, (response) => {
          const len = parseInt(response.headers['content-length'], 10);

          response.on('data', (chunk) => {
            cur += chunk.length;
            data.push(chunk);
            progress = Math.round((cur / len) * 10) / 10;
            if (progress !== lastProgress) {
              lastProgress = progress;
              log.info(String(progress * 100)+'%');
            }
          });

          response.on('end', () => {
            const extensions = this.image_extensions;
            // Delete old image(s)
            // Stormyninja
            // glob is causing synchronicity issues of some kind
            extensions.forEach(x => {
              let deleting = `${noext}.${x}`;
              if (fs.existsSync(deleting)){
                fs.unlinkSync(deleting);
              }
            });
            fs.writeFileSync(dest, data.read());
            resolve(dest);
          });
        }).on('error', (err) => {
          fs.unlink(dest);
          reject(err);
        });
      });
    })
  }

  static deleteCustomImage(type, userdataGridPath, appid) {
      const imagePath = this.getCustomImage(type, userdataGridPath, appid);
      if (imagePath) {
          fs.unlinkSync(imagePath);
      }
  }

  static addShortcuts(shortcuts) {
    return new Promise((resolve) => {
      this.getShortcutFile().then((shortcutPath) => {
        shortcut.parseFile(shortcutPath, (err, items) => {
          const newShorcuts = {
            shortcuts: [],
          };

          let apps = [];
          if (typeof items !== 'undefined') {
            apps = items.shortcuts;
          }

          shortcuts.forEach((value) => {
            // Don't add dupes
            apps.some((app) => {
              const appid = this.generateAppId(app.exe, app.appname);
              if (this.generateAppId(value.exe, value.name) === appid) {
                return true;
              }
              return false;
            });

            apps.push({
              appname: value.name,
              exe: value.exe,
              StartDir: value.startIn,
              LaunchOptions: value.params,
              icon: (typeof value.icon !== 'undefined' ? value.icon : ''),
              IsHidden: false,
              ShortcutPath: '',
              AllowDesktopConfig: true,
              OpenVR: false,
              tags: (typeof value.tags !== 'undefined' ? value.tags : []),
            });
          });

          newShorcuts.shortcuts = apps;

          shortcut.writeFile(shortcutPath, newShorcuts, () => resolve());
        });
      });
    });
  }

  static addCategory(games, categoryId) {
    return new Promise((resolve, reject) => {
      const levelDBPath = join(process.env.localappdata, 'Steam', 'htmlcache', 'Local Storage', 'leveldb');
      this.getLoggedInUser().then((user) => {
        const cats = new Categories(levelDBPath, String(user));
        cats.read().then(() => {
          this.getCurrentUserGridPath().then((userGridPath) => {
            const localConfigPath = join(userGridPath, '../', 'localconfig.vdf');
            const localConfig = VDF.parse(fs.readFileSync(localConfigPath, 'utf-8'));

            let collections = {};
            if (localConfig.UserLocalConfigStore.WebStorage['user-collections']) {
              collections = JSON.parse(localConfig.UserLocalConfigStore.WebStorage['user-collections'].replace(/\\/g, ''));
            }

            games.forEach((app) => {
              const platformName = categoryId;
              const appId = this.generateNewAppId(app.exe, app.name);

              // Create new category if it doesn't exist
              const catKey = `sgdb-${platformName}`; // just use the name as the id
              const platformCat = cats.get(catKey);
              if (platformCat.is_deleted || !platformCat) {
                cats.add(catKey, {
                  name: platformName,
                  added: [],
                });
              }

              // Create entry in localconfig.vdf
              if (!collections[catKey]) {
                collections[catKey] = {
                  id: catKey,
                  added: [],
                  removed: [],
                };
              }

              // Add appids to localconfig.vdf
              if (collections[catKey].added.indexOf(appId) === -1) {
                // Only add if it doesn't exist already
                collections[catKey].added.push(appId);
              }
            });

            cats.save().then(() => {
              localConfig.UserLocalConfigStore.WebStorage['user-collections'] = JSON.stringify(collections).replace(/"/g, '\\"'); // I hate Steam

              const newVDF = VDF.stringify(localConfig);
              fs.writeFileSync(localConfigPath, newVDF);
              cats.close();
              return resolve();
            });
          });
        }).catch((err) => {
          reject(err);
        });
      });
    });
  }
}

export default Steam;
