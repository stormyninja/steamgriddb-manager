const Store = window.require('electron-store');
const SGDB = window.require('steamgriddb');
const metrohash64 = window.require('metrohash').metrohash64;
const log = window.require('electron-log');
import PubSub from 'pubsub-js';
import React from 'react';
import settle from 'promise-settle';
import PropTypes from 'prop-types';
import Image from 'react-uwp/Image';
import ImportList from './ImportList';
import ImportAllButton from './ImportAllButton.js';
import Spinner from './spinner.js';
import TopBlur from './TopBlur';
import Steam from './Steam';
import platformModules from './importers';
import {officialList} from './importers';
// NOTE: 'official' importers are ones where api supports getting grids by platform id

class Import extends React.Component {
    constructor(props) {
        super(props);

        this.changeAlt = this.changeAlt.bind(this);
        this.addGame = this.addGame.bind(this);
        this.addGames = this.addGames.bind(this);
        this.getPlatformArt = this.getPlatformArt.bind(this);

        this.store = new Store();

        this.platforms = Object.keys(platformModules).map((key) => ({
            id: platformModules[key].id,
            name: platformModules[key].name,
            class: platformModules[key].default,
            error: false
        }));

        this.SGDB = new SGDB(process.env.STEAMGRIDDB_API_KEY);

        this.state = {
            isLoaded: false,
            games: {}
        };
    }

    componentDidMount() {
        Promise.all(this.platforms.map((platform) => platform.class.isInstalled()))
            .then((values) => {
                for (let i = 0; i < values.length; i++) {
                    this.platforms[i].installed = values[i];
                }

                // Generate array of getGames() promises if installed
                const getGamesPromises = this.platforms.map((platform) => {
                    if (platform.installed) {
                        return platform.class.getGames();
                    }
                    else {
                        return false;
                    }
                });

                settle(getGamesPromises).then((results) => {
                    const games = {};
                    let platform_grid_promises = [];

                    // for each installed platform
                    results.forEach((result, index) => {
                        const platform = this.platforms[index];
                        const platform_games = result.value();
                        if (result.isFulfilled() && platform_games !== false) {
                            games[platform.id] = platform_games;
                            platform_grid_promises.push(this.getPlatformArt(platform_games, platform));
                        }
                        else if (result.isRejected()) {
                            // getGames() rejected
                            platform.error = true;
                            platform.errorReason = result.reason();
                            games[platform.id] = [];
                            platform_grid_promises.push(false);
                            log.info(`Import: ${platform.id} rejected ${result.reason()}`);
                        }
                        else {
                            // not installed
                            games[platform.id] = false;
                            platform_grid_promises.push(false);
                            log.info(`Import: ${platform.id} not installed`);
                        }
                    });

                    Promise.all(platform_grid_promises).then((values) => {
                        this.setState({
                            isLoaded: true,
                            games: games,
                            grids: values
                        });
                    });
                });
            });
    }

    // Given games and their corresponding platform,
    // look up each game in the steam databse to fetch "official"
    // steam art, then get art from steamgriddb by platform game
    // id for official platforms, or by game name for unofficial ones.
    getPlatformArt(games, platform){
      return new Promise((resolve, reject) => {
        const game_art = {};
        const game_ids = games.map((x) => encodeURIComponent(x.id)); // Comma separated list of IDs for use with SGDB API
        const api_ids_string = game_ids.join(',');
        const alt_name_promises = games.map(game => {
            game.use_alt = false;
            game.alt_name = this.SGDB.searchGame(game.name).then(res => {
              if(res.length > 0){
                return game.name != res[0].name ? res[0].name : null;
              }
              return null;
            });
            return game.alt_name;
        });

        const platform_game_art = Promise.all(alt_name_promises).then(alt_names=>{
          const game_names = games.map(game=>game.name);
          return Steam.getSteamIdsFromShortcuts(game_names.concat(alt_names)).then((lookup)=>{
              games.forEach((game, i) => {
                  game.alt_name = alt_names[i];
                  if (game.name == "Roombo"){
                      log.info("THIS IS ROOMBO");
                      log.info(alt_names[i]);
                  }
                  const appid = Steam.generateAppId(game.exe, game.name);
                  const steamid = lookup[game.name] || lookup[game.alt_name] || undefined;
                  game_art[game.id] = {};
                  game_art[game.id]['db'] = {};
                  game_art[game.id]['steam'] = {};
                  if(steamid){
                      game_art[game.id]['steam'] = Steam.getDefaultGridImages(steamid);
                  }
              });
              return game_art;
           }).then(game_art=>{
             if (officialList.includes(platform.id)){
               log.info('official');
               // return this.SGDB.getGrids({type: platform.id, id: api_ids_string, dimensions:['460x215','920x430']}).then((res)=>{
               return this.SGDB.getGrids({type: platform.id, id: api_ids_string}).then((res)=>{
                 if(games.length > 1){
                   res.forEach((game, i)=>{
                     game_art[game_ids[i]]['db']['bigpicture'] = game.success && game.data && game.data.length > 0 ? game.data[0].url : null;
                     game_art[game_ids[i]]['db']['thumb'] = game.success && game.data && game.data.length > 0 ? game.data[0].thumb : null;
                   });
                 }
                 else{
                   game_art[game_ids[0]]['db']['bigpicture'] = res.length > 0 ? res[0].url : null;
                   game_art[game_ids[0]]['db']['thumb'] = res.length > 0 ? res[0].url : null;
                 }
                 return game_art;
               }).then(game_art=>{
                 return this.SGDB.getGrids({type: platform.id, id: api_ids_string, dimensions:['600x900']}).then((res)=>{
                   if(games.length > 1){
                     res.forEach((game,  i)=>{
                       game_art[game_ids[i]]['db']['library'] = game.success && game.data && game.data.length > 0 ? game.data[0].url : null;
                     });
                   }
                   else {
                     game_art[game_ids[0]]['db']['library'] = res.length > 0 ? res[0].url : null;
                   }
                   return game_art;
                 }).catch(log.error);
               }).catch(log.error);
             }
             else {
               log.info('unofficial');
               return games.reduce((arts, game, i)=>{
                   arts = new Promise((resolve, reject)=>{
                       resolve(game_art);
                   });
                   return arts.then(game_art=>{
                       return this.SGDB.searchGame(game.name).then((res) => {
                       if (res.length > 0){
                         return this.SGDB.getGridsById(res[0].id).then((grids) => {
                             game_art[game_ids[i]]['db']['bigpicture'] = grids.length > 0 ? grids[0].url : null;
                             game_art[game_ids[i]]['db']['thumb'] = grids.length > 0 ? grids[0].thumb : null;
                             return game_art;
                         }).then(game_art=>{
                           return this.SGDB.getGridsById(res[0].id, [], ['600x900']).then((grids) => {
                               game_art[game_ids[i]]['db']['library'] = grids.length > 0 ? grids[0].url : null;
                               return game_art;
                           }).catch(log.error);
                         }).catch(log.error);
                       }
                       else{
                         game_art[game_ids[i]]['db']['library'] = null;
                         game_art[game_ids[i]]['db']['bigpicture'] = null;
                         game_art[game_ids[i]]['db']['thumb'] = null;
                         return game_art;
                       }
                     }).catch(log.error);
                   })
               },games[0]);
             }
           }).catch(log.error);
        }).catch(log.error);


        return resolve(platform_game_art);
      });
    }


    platformGamesSave(games) {
        let gamesStorage = this.store.get('games');
        if (!gamesStorage) {
            gamesStorage = {};
        }

        games.forEach((game) => {
            gamesStorage[metrohash64(game.exe+(typeof game.params !== 'undefined' ? game.params : ''))] = game;
        });
        this.store.set('games', gamesStorage);
    }

    platformGameSave(game) {
        this.store.set(`games.${metrohash64(game.exe+(typeof game.params !== 'undefined' ? game.params : ''))}`, game);
    }

    platformGameRemove(game) {
        this.store.delete(`games.${metrohash64(game.exe+game.params)}`);
    }

    addGames(games, grids, platform) {
        this.platformGamesSave(games);

        // Add shortcuts with platform name as tag
        Steam.addShortcuts(games.map((game) => {
            game.tags = [platform.name];
            game.name = game.use_alt ? game.alt_name : game.name;
            delete game['idx'];
            delete game['alt_name'];
            delete game['use_alt'];
            return game;
        }));
        const addGridPromises = [];
            games.forEach((game, i) => {
              log.info(game.name);
                const gamegrids = grids[game.id];
                const appid = Steam.generateAppId(game.exe, game.name);
                Object.keys(Steam.steam_server_remap).forEach(arttype=>{
                    const grid = gamegrids.steam[arttype] || gamegrids.db[arttype];
                    if (grid != null && arttype != 'thumb'){
                      log.info(`${arttype} is ${grid}`)
                      const gamesClone = Object.assign({}, this.state.games);
                      const addGrid = Steam.addGrid(appid, 'shortcut', grid, arttype, (progress) => {
                          gamesClone[platform.id][gamesClone[platform.id].indexOf(game)].progress = progress;
                          this.setState({gamesClone});
                      });
                      addGridPromises.push(addGrid);
                    }
                });
            });
        Promise.all(addGridPromises).then(() => {
            PubSub.publish('toast', {logoNode: 'ImportAll', title: 'Successfully Imported!', contents: (
                <p>{games.length} games imported from {platform.name}</p>
            )});
        });
    }

    addGame(game, image, platform) {
        this.platformGameSave(game);
        Steam.addShortcuts([{
            name: game.name,
            exe: game.exe,
            startIn: game.startIn,
            params: game.params,
            tags: [platform.name],
            icon: game.icon
        }]);

        Steam.getSteamIdsFromShortcuts([game.name]).then((lookup)=>{
            const appid = Steam.generateAppId(game.exe, game.name);
            const steamid = lookup[game.name] || undefined;
            if(steamid){
                let default_images = Steam.getDefaultGridImages(steamid);
                const addGridPromises = [];

                Object.keys(default_images).forEach(key=>{
                    const gamesClone = Object.assign({}, this.state.games);
                    const addGrid = Steam.addGrid(appid, 'shortcut', default_images[key], key, (progress) => {
                        gamesClone[platform.id][gamesClone[platform.id].indexOf(game)].progress = progress;
                        this.setState({gamesClone});
                    });
                    addGridPromises.push(addGrid);

                });
                Promise.all(addGridPromises).then(() => {
                    PubSub.publish('toast', {logoNode: 'Import', title: `Successfully Imported: ${game.name}`, contents: (
                        <Image
                            style={{width: '100%', marginTop: 10}}
                            src={default_images['library']}
                        />
                    )});
                });

            }
            else if (image) {
                const gamesClone = Object.assign({}, this.state.games);
                Steam.addGrid(Steam.generateAppId(game.exe, game.name), 'shortcut', image, 'bigpicture', (progress) => {
                    gamesClone[platform.id][gamesClone[platform.id].indexOf(game)].progress = progress;
                    this.setState({gamesClone});
                }).then((dest) => {
                    PubSub.publish('toast', {logoNode: 'Import', title: `Successfully Imported: ${game.name}`, contents: (
                        <Image
                            style={{width: '100%', marginTop: 10}}
                            src={dest}
                        />
                    )});
                }).catch((err) => {
                    PubSub.publish('toast', {logoNode: 'Error', title: `Failed to import: ${game.name}`, contents: (
                        <p>{err.message}</p>
                    )});
                });
            }
        });

    }

    changeAlt(game) {
      log.info("Changing alt");
      log.info(`Attempting to change alt for ${game.name}`)
      const scrubbed_game = Object.assign({}, this.state.games);
      delete scrubbed_game['progress'];
      delete scrubbed_game['idx'];
      delete scrubbed_game['alt_name'];
      this.platformGameSave(scrubbed_game);
      const gamesClone = Object.assign({}, this.state.games);
      log.info(gamesClone[game.platform][game.idx]);
      gamesClone[game.platform][game.idx].use_alt = !game.use_alt;
      this.setState({gamesClone});
    }


    render() {
        const {isLoaded, games, grids} = this.state;

        if (!isLoaded) {
            return (<Spinner/>);
        }

        // if no launcher installed
        let noLaunchers = false;
        if (Object.values(games).every((x) => x === false)) {
            noLaunchers =
                <div style={{padding: 15, paddingLeft: 10, textAlign: 'center', ...this.context.theme.typographyStyles.body}}>
                    <p>Looks like you have no launchers installed.</p>
                    <p>The following launchers are supported: {this.platforms.map((x) => x.name).join(', ')}</p>
                </div>;
        }

        return (
            <>
                <TopBlur/>
                <div id="import-container" style={{height: '100%', overflow: 'auto', padding: 15, paddingLeft: 10, paddingTop: 45}}>
                    {noLaunchers ? (
                        noLaunchers
                    ) : (
                        Object.keys(games).map((platform, i) => {
                            if (this.platforms[i].installed) {
                                if (!this.platforms[i].error) {
                                    return (
                                        <div key={i}>
                                            <h5 style={{float: 'left', ...this.context.theme.typographyStyles.subTitle}}>{this.platforms[i].name}</h5>
                                            <ImportAllButton
                                                games={games[platform]}
                                                grids={grids[i]}
                                                platform={this.platforms[i]}
                                                onButtonClick={this.addGames}
                                            />
                                            <ImportList
                                                games={games[platform]}
                                                platform={this.platforms[i]}
                                                grids={grids[i]}
                                                onImportClick={this.addGame}
                                                onChangeAlt={this.changeAlt}
                                            />
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div key={i}>
                                            <h5 style={this.context.theme.typographyStyles.subTitle}>{this.platforms[i].name}</h5>
                                            <p>Error importing: {this.platforms[i].errorReason.message}</p>
                                        </div>
                                    );
                                }
                            }
                        })
                    )}
                </div>
            </>
        );
    }
}

Import.contextTypes = { theme: PropTypes.object };
export default Import;
