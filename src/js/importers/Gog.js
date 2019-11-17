const Registry = window.require('winreg');
const fs = window.require('fs');
const promiseReflect = window.require('promise-reflect');
const log = window.require('electron-log');
const sqlite3 = window.require('sqlite3');

class Gog {
  static isInstalled() {
    return new Promise((resolve, reject) => {
      let installed = null;
      if (process.platform == 'darwin') {
        installed = fs.existsSync('/Applications/GOG\ Galaxy.app');
      }
      else if (process.platform == 'win32') {
        const reg = new Registry({
          hive: Registry.HKLM,
          arch: 'x86',
          key: '\\SOFTWARE\\GOG.com\\GalaxyClient\\paths'
        });

        reg.get('client', (err, installDir) => {
          if (err) {
            if (err.code == 1) {
              return resolve(false);
            }
            reject(new Error('Could not check if GOG Galaxy is installed.'));
          }
          installed = fs.existsSync(installDir.value);
        });
      }
      resolve(installed);
    });
  }

  static getGogPath() {
    return new Promise((resolve, reject) => {
      const reg = new Registry({
        hive: Registry.HKLM,
        arch: 'x86',
        key: '\\SOFTWARE\\GOG.com\\GalaxyClient\\paths'
      });

      reg.get('client', (err, installDir) => {
        if (err) {
          reject(new Error('Could not find GOG Galaxy path.'));
        }

        resolve(installDir.value);
      });
    });
  }

  static _processRegKey(key) {
    return new Promise((resolve, reject) => {
      key.get('dependsOn', (err, dependsOn) => {
        if (dependsOn == null) {
          key.values((err, items) => {
            const game = {
              platform: 'gog'
            };

            items.forEach((item) => {
              if (item.name === 'gameID' || item.name === 'GAMEID') {
                game.id = item.value;
              }

              if (item.name === 'gameName' || item.name === 'GAMENAME') {
                game.name = item.value;
              }

              if (item.name === 'exe' || item.name === 'EXE') {
                game.exe = `"${item.value}"`;
              }

              if (item.name === 'launchParam' || item.name === 'LAUNCHPARAM') {
                game.params = item.value;
              }

              if (item.name === 'path' || item.name === 'PATH') {
                game.startIn = `"${item.value}"`;
              }
            });
            resolve(game);
          });
        } else {
          reject(key);
        }
      });
    });
  }

  static getGames() {
    return new Promise((resolve, reject) => {
      log.info('Import: Started gog');
      if (process.platform == 'darwin') {
        let db = new sqlite3.Database('/Users/Shared/GOG.com/Galaxy/Storage/galaxy.db', sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            log.error(err.message);
            reject(new Error('Could not connect to Galaxy database.'));
          }
          log.info('Connected to the Galaxy database.');
        });
        let games = [];
        db.serialize(() => {
          db.each(`SELECT InstalledBaseProducts.productId as gogid, installationPath as gamepath, title as name, images, slug  FROM InstalledBaseProducts JOIN 'Product Details View' ON InstalledBaseProducts.productId = 'Product Details View'.productId`, (err, row) => {
            if (err) {
              log.error(err.message);
              reject(new Error('Could not get data from Galaxy database.'));
            }
            games.push({
              id: row.gogid,
              name: row.name,
              exe: `"${row.gamepath}"`,
              icon: `"${row.gamepath}"`,
              startIn: `"${row.gamepath.substr(0,row.gamepath.lastIndexOf('/') + 1)}"`,
              platform: 'gog'
            });
          });
        });

        db.close((err) => {
          if (err) {
            log.error(err.message);
            reject(new Error('Could not close Galaxy Database.'));
          }
        });
        return resolve(games);
      }
      else if (process.platform == 'win32') {
        this.getGogPath().then(() => {
          const reg = new Registry({
            hive: Registry.HKLM,
            arch: 'x86',
            key: '\\SOFTWARE\\GOG.com\\Games'
          });

          reg.keys((err, keys) => {
            if (err) {
              reject(new Error('Could not get GOG games.'));
            }

            if (keys) {
              const promiseArr = keys.map((key) => this._processRegKey(key).then((res) => res));
              Promise.all(promiseArr.map(promiseReflect))
                .then((results) => results.filter((result) => result.status === 'resolved').map((result) => result.data))
                .then((results) => {
                  log.info('Import: Completed gog');
                  resolve(results);
                });
            } else {
              return resolve([]);
            }
          });
        }).catch((err) => reject(err));
      }
    });
  }
}

export default Gog;
export const name = 'GOG.com';
export const id = 'gog';
export const official = true;
