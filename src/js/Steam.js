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

const steamAPI = new SteamAPI(process.env.STEAM_API_KEY);

class Steam {
    constructor() {
        this.steamPath = null;
        this.loggedInUser = null;
        this.currentUserGridPath = null;
    }

    //steam does not currently store icons in appid*.ext format
    static art_type_suffix = {
      library: 'p',
      bigpicture: '',
      hero: '_hero',
      logo: '_logo',
    }

    // will eventually add settings to remap arttypes to server filenames
    static steam_server_filenames = {
      small: 'capsule_231x87.jpg',
      library: 'library_600x900.jpg',
      library2x: 'library_600x900_2x.jpg',
      bigpicture: 'header.jpg',
      background: 'page.bg.jpg',
      hero: 'library_hero.jpg',
      logo: 'logo.png',
      gen_background: 'page_bg_generated.jpg',
      gen_background6: 'page_bg_generated_v6b.jpg' // unclear what the differences in page_bg images is
    }

    // stormy
    // change this to run once on startup, then save to variable for further use
    // https://medium.com/dailyjs/rewriting-javascript-converting-an-array-of-objects-to-an-object-ec579cafbfc7
    // efficient map
    static getSteamAppLookup(){
      return new Promise((resolve, reject) => {
        steamAPI.getAppList().then((response) => {
          let appdict = response.reduce((obj, item)=>{
            obj[item.name] = item.appid;
            return obj;
          },{});
          this.steamidLookup = appdict;
          log.info('Successfully connected to the Steam database.');
          resolve(appdict);
        })
        .catch((err)=>{
          log.info('There was an error connecting to the Steam database.');
          log.info(err);
          reject({});
        });
      });
    }

    // Unclear on whether this method is needed
    // Makes a nice loggable dict of appname:steamid for shortcuts
    static getSteamIdsFromShortcuts(names) {
      return this.getSteamAppLookup().then((appdict) => {
        let steamidmap =  names.reduce((obj,name)=>{
          obj[name] = appdict[name];
          return obj;
        },{});
        log.info(`Found Steam entries for ${Object.keys(steamidmap).length} shortcuts:`)
        this.shortcutLookup = steamidmap;
      });
    }

    static getAppidByArttype(){

    }

    static getSteamPath() {
        return new Promise((resolve, reject) => {
            if (this.steamPath) {
                return resolve(this.steamPath);
            }

            // We're on a mac, use mac path
            let steamPath = false;
            if(process.platform == 'darwin'){
              log.info('Using MacOS');
              steamPath = `/Users/${process.env.USER}/Library/Application\ Support/Steam`;
            }

            // We're on a pc, search registry
            else if (process.platform == 'win32'){
              log.info('Using Windows');
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
                        log.info(`library: ${appsPath}`);
                        const files = fs.readdirSync(appsPath);
                        // fails if steam has not been run since a removable drive library was disconnected
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
                                      type: 'game'
                                  });
                              } catch(err) {
                                  log.warn(`Error while parsing ${file}: ${err}`);
                                  return;
                              }
                            }
                        });
                    });
                    log.info(`Fetched ${games.length} Steam games`);

                    resolve(games);
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

                        log.info(`Found ${items.shortcuts.length} shortcuts`);

                        let appnames = items.shortcuts.map(x => x.AppName | x.appname);
                        this.getSteamIdsFromShortcuts(appnames).then((result)=>{
                          items.shortcuts.forEach((item) => {
                              const appName = item.appname || item.AppName;
                              const exe = item.exe || item.Exe;
                              const appid = this.generateAppId(exe, appName);
                              const steamid = this.steamidLookup[appName] | undefined;

                              let custom_images = this.getCustomGridImages(userdataGridPath, appid, true)
                              let images = {custom_images};
                              if(steamid){
                                let default_images = this.getDefaultGridImages(steamid);
                                Object.keys(this.art_type_suffix).forEach((key)=>{
                                  images[key] = custom_images[key] ? custom_images[key] : default_images[key];
                                });
                              }

                              // stormy
                              // check what gameid is actually for; tracking platform's id?
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
                                      type: 'shortcut'
                                  });
                              } else {
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
                let gameid = (is_shortcut && arttype == 'bigpicture')? this.lengthenShortcutId(appId) : appId;
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
