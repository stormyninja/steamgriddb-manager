const Registry = window.require('winreg');
const yaml = window.require('js-yaml');
const fs = window.require('fs');
const path = window.require('path');
const log = window.require('electron-log');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

class MacAppStore {
    static isInstalled() {
        return new Promise((resolve, reject) => {
            return resolve(false);
            /*
            // Terminal command to get list of all applications in applications folder installed from mac app store
            find /Applications \
            -path '*Contents/_MASReceipt/receipt' \
            -maxdepth 4 -print |\
            sed 's#.app/Contents/_MASReceipt/receipt#.app#g; s#/Applications/##'


            defaults read /Applications/Slack\.app/Contents/Info LSApplicationCategoryType

            */


            // var test1 = exec("find /Applications \
            // -path '*Contents/_MASReceipt/receipt' \
            // -maxdepth 4 -print |\
            // sed 's#.app/Contents/_MASReceipt/receipt#.app#g; s#/Applications/##'", function(e){
            //   log.info(e);
            //   return e;
            // });
            const find = spawn('find', ['/Applications', '-path', "'*Contents/_MASReceipt/receipt'"]);
            const wc = spawn('wc', ['-l']);

            find.stdout.pipe(wc.stdin);

            wc.stdout.on('data', (data) => {
              log.info(`Number of files ${data}`);
            });
            //log.info(test2);
            resolve(true);
        });
    }

    static getGames() {
        return new Promise((resolve, reject) => {
          //todo

        });
    }
}

export default MacAppStore;
export const name = 'MacAppStore';
export const id = 'macappstore';
export const official = true;
