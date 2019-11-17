const Registry = window.require('winreg');
const yaml = window.require('js-yaml');
const fs = window.require('fs');
const path = window.require('path');
const log = window.require('electron-log');

class DRMFree {
    static isInstalled() {
        return new Promise((resolve, reject) => {

            /*
            // Terminal command to get list of all applications in applications folder installed from mac app store
            find /Applications \
            -path '*Contents/_MASReceipt/receipt' \
            -maxdepth 4 -print |\
            sed 's#.app/Contents/_MASReceipt/receipt#.app#g; s#/Applications/##'


            defaults read /Applications/Slack\.app/Contents/Info LSApplicationCategoryType

            */
            
        });
    }

    static getGames() {
        return new Promise((resolve, reject) => {
          //todo

        });
    }
}

export default DRMFree;
export const name = 'DRMFree';
export const id = 'drmfree';
export const official = false;
