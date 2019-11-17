const Registry = window.require('winreg');
const yaml = window.require('js-yaml');
const fs = window.require('fs');
const path = window.require('path');
const log = window.require('electron-log');
const spawn = require('child_process').spawn;

class MacAppStore {
  static isInstalled() {
    return new Promise((resolve, reject) => {
      /*
            // Terminal command to get list of all applications in applications folder installed from mac app store
            find /Applications \
            -path '*Contents/_MASReceipt/receipt' \
            -maxdepth 4 -print |\
            sed 's#.app/Contents/_MASReceipt/receipt#.app#g; s#/Applications/##'


            defaults read /Applications/Slack\.app/Contents/Info LSApplicationCategoryType
            find /Applications -path '*Contents/_MASReceipt/receipt' -maxdepth 4 | sed 's#.app/Contents/_MASReceipt/receipt#.app#g; s#/Applications/##'

find /Applications -path '*Contents/_MASReceipt/receipt' -maxdepth 4 | sed 's#.app/Contents/_MASReceipt/receipt#.app#g; s#/Applications/##'
            */
      if (process.platform == 'darwin'){
        return resolve(true);
      }
      else {
        return resolve(false);
      }

    });
  }


  static getGames() {
    const mac_app_store_game_categories = ['games','action-games','adventure-games','arcade-games','board-games','card-games','casino-games','dice-games','educational-games','family-games','kids-games','music-games','puzzle-games','racing-games','role-playing-games','simulation-games','sports-games','strategy-games','trivia-games','word-games'];
    return new Promise((resolve, reject) => {
      const find = spawn('find', ['/Applications', '-path', '*Contents/_MASReceipt/receipt', '-maxdepth', '4', '-print']);
      const sed = spawn('sed', ['s#/_MASReceipt/receipt#/Info#g;']);
      find.stdout.pipe(sed.stdin);

      let macapps = '';
      sed.stdout.on('data', data => {
        macapps += data // gather chunked data
      });
      sed.stderr.on('data', data => {
        console.log(`stderr: ${data}`)
      });
      sed.on('close', code => {
        console.log(`child process exited with code ${code}`)
      });
      sed.stdout.on('end', function() {
        let dict = {};
        let final = macapps.split('\n').map(app => {
          if (app != '') {
            return new Promise((resolve, reject) => {
              const def = spawn('defaults', ['read', app, 'LSApplicationCategoryType']);
              let category = '';
              def.stdout.on('data', data => {
                category += data // gather chunked data
              })
              def.stderr.on('data', data => {
                console.log(`stderr: ${data}`)
              });
              def.stdout.on('end', function() {
                category = category.substr(category.lastIndexOf('.') + 1).split('\n')[0];
                if (mac_app_store_game_categories.includes(category)) {
                  const defid = spawn('defaults', ['read', app, 'CFBundleIdentifier']);
                  let id = '';
                  defid.stdout.on('data', data => {
                    id += data // gather chunked data
                  })
                  defid.stderr.on('data', data => {
                    console.log(`stderr: ${data}`)
                  });
                  defid.stdout.on('end', function() {
                    let name = app.split('.app')[0].split('/')[2];
                    let exe = app.split('.app')[0].concat('.app');
                    resolve({
                      name: name,
                      id: id.split('\n')[0],
                      exe: `"${exe}"`,
                      icon: `"${exe}"`,
                      startIn: `"/Applications/"`,
                      platform: 'mas'
                    });
                  });
                }
                else {
                  resolve();
                }
              });
            });
          }
        });
        Promise.all(final).then((result) => {
          resolve(result.filter(e=>{return e != null}));
        });
      });
    });
  }
}
export default MacAppStore;
export const name = 'Mac App Store';
export const id = 'mas';
export const official = false;
