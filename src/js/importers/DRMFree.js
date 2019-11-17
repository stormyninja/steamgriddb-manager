const Registry = window.require('winreg');
const yaml = window.require('js-yaml');
const fs = window.require('fs');
const path = window.require('path');
const log = window.require('electron-log');

class DRMFree {
    static isInstalled() {
        return new Promise((resolve, reject) => {

            // Epic does support MacOS games, but need to re-do registry stuff
            if(process.platform == 'darwin'){
              return resolve(true);
            }
            else if (process.platform == 'win32'){
              // for now because I've not added nor tested from file imports on windows
              return resolve(false);
            }
        });
    }

    static searchDir(games,dir, maxdepth){
        fs.readdirSync(dir).forEach((file)=>{
          if(file.includes('.app')){
            const exe = path.join(dir,file);
            const name = file.split('.app')[0];
            const slug = name.toLowerCase().replace(/\s/g, '');
            games.push({
              id: slug,
              name: name,
              exe: `"${exe}"`,
              icon: `"${dir}"`,
              startIn: `"${dir}/"`,
              platform: 'drmfree'
            });
          }
          else {
            const filepath = path.join(dir,file);
            const stat = fs.lstatSync(filepath);
            if (stat.isDirectory() && maxdepth > 0){
                games.concat(this.fromDir(games, filepath, maxdepth - 1));
            }
          }
        });
        return games;
    };

    static getGames() {
        return new Promise((resolve, reject) => {
            log.info('Import: Started drmfree');
            const search_depth = 5;
            const base_dir = '/Volumes/GameDrive/Humble\ Trove'
            let games = [];
            if (!fs.existsSync(base_dir)){
                log.info(`Directory ${base_dir} not found`);
            }
            else{
              this.searchDir(games,base_dir,search_depth);
            }
            return resolve(games);
        });
    }
}

export default DRMFree;
export const name = 'DRM Free';
export const id = 'drmfree';
export const official = false;
