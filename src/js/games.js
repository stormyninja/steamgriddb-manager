import React from 'react';
import PropTypes from 'prop-types';
import {Redirect} from 'react-router-dom';
import Spinner from './spinner.js';
import GridImage from './gridImage.js';
import AutoSuggestBox from 'react-uwp/AutoSuggestBox';
import AppBarButton from 'react-uwp/AppBarButton';
import AppBarSeparator from 'react-uwp/AppBarSeparator';
import CommandBar from "react-uwp/CommandBar";
import Grid from './Grid';
import Steam from './Steam';
import queryString from 'query-string';
import Fuse from 'fuse.js';
import PubSub from 'pubsub-js';
import {debounce} from 'lodash';
import {forceCheck} from 'react-lazyload';
import TopBlur from './TopBlur';
const log = window.require('electron-log');
import platformModules from './importers';

class Games extends React.Component {
    constructor(props) {
        super(props);
        this.toSearch = this.toSearch.bind(this);
        this.changeMode = this.changeMode.bind(this);
        this.appBarButtons = this.appBarButtons.bind(this);
        this.commandBar = this.commandBar.bind(this);
        this.refreshGames = this.refreshGames.bind(this);
        this.filterGames = this.filterGames.bind(this);
        this.searchInput = debounce((searchTerm) => {
            this.filterGames(searchTerm);
        }, 300);

        const qs = this.props.location && queryString.parse(this.props.location.search);
        this.scrollToTarget = qs.scrollto;

        this.zoom = 1;
        //this.arttype='bigpicture';
        this.sizes = {
          library: ["600x900"],
          bigpicture: undefined
        };

        this.modes=['library','bigpicture','logo','hero'];

        this.fetchedGames = {}; // Fetched games are stored here and shouldn't be changed unless a fetch is triggered again
        this.platformNames = {
            'steam': 'Steam',
            'other': 'Other Games'
        };

        Object.keys(platformModules).forEach((module) => {
            this.platformNames[platformModules[module].id] = platformModules[module].name;
        });

        if(process.platform == 'darwin'){
          log.info('Using MacOS');
        }
        if(process.platform == 'win32'){
          log.info('Using Windows');
        }
        this.state = {
            error: null,
            isLoaded: false,
            isHover: false,
            toSearch: false,
            hasSteam: true,
            arttype: qs.arttype ? qs.arttype : 'library',
            items: {}
        };
    }

    componentDidMount() {
        if (Object.entries(this.state.items).length <= 0) {
            Steam.getSteamPath().then(() => {
                this.fetchGames();
            }).catch(() => {
                log.warn('Steam is not installed');
                this.setState({
                    hasSteam: false
                });
            });
        }
    }

    componentDidUpdate(prevProps, prevState) {
        log.info(`Now in ${this.state.arttype} mode`)
        if (Object.entries(prevState.items).length === 0 && this.scrollToTarget) {
            this.scrollTo(this.scrollToTarget);
            PubSub.publish('showBack', false);
        }
    }

    fetchGames() {
        // const steamGamesPromise = Steam.getSteamGames();
        // const steamGamesPromise = Steam.getOwnedSteamGames();
        const steamGamesPromise = Steam.getOwnedGamesByApi();
        const nonSteamGamesPromise = Steam.getNonSteamGames();
        Promise.all([steamGamesPromise, nonSteamGamesPromise]).then((values) => {
            const items = {steam: values[0], ...values[1]};
            // Sort games alphabetically
            for (const platform in items) {
                items[platform] = items[platform].sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
            }

            this.fetchedGames = items;
            this.setState({
                isLoaded: true,
                items: items
            });
        });
    }

    toSearch(props) {
        const parsedQs = queryString.stringify({
            game: props.name,
            appid: props.appid,
            steamid: props.steamid,
            gameType: props.gameType,
            gameId: props.gameId,
            platform: props.platform,
            arttype: props.arttype,
            styles: undefined,
            dimensions: this.sizes[props.arttype]
        });

        const to = `/search/?${parsedQs}`;
        this.setState({
            toSearch: <Redirect to={to} />
        });
    }

    changeMode = arttype => () => {
        this.setState({
            isLoaded: false,
            arttype: arttype
        });
        this.fetchGames();
    }

    // change this to NOT fetch games again
    refreshGames() {
        this.setState({
            isLoaded: false
        });
        this.fetchGames();
    }

    filterGames(searchTerm) {
        const items = Object.assign({}, this.fetchedGames);
        if (searchTerm.trim() === '') {
            this.setState({
                items: items
            });
            return;
        }

        Object.keys(items).forEach((platform) => {
            const fuse = new Fuse(items[platform], {
                shouldSort: true,
                threshold: 0.6,
                location: 0,
                distance: 100,
                maxPatternLength: 32,
                minMatchCharLength: 1,
                keys: [
                    'name'
                ]
            });
            items[platform] = fuse.search(searchTerm);
        });
        this.setState({
            items: items
        });

        forceCheck(); // Recheck lazyload
    }

    scrollTo(id) {
        document.getElementById(`game-${id}`).scrollIntoView(true);
        document.querySelector('#grids-container').scrollTop -= 75; // scroll down a bit cause grid goes under floating launcher name
    }

    addNoCache(imageURI) {
        if (!imageURI) {
            return false;
        }

        return `${imageURI}?${(new Date().getTime())}`;
    }


    appBarButtons(){
      // TVMonitor, Games, Library, Refresh, Picture, Gridview, BackgroundToggle
      // doesnt work: Favicon, RTTLogo
      // https://docs.microsoft.com/en-us/windows/uwp/design/style/segoe-ui-symbol-font
      let modes = {
        library:{
          icon: 'Library',
          label: 'Library'
        },
        bigpicture:{
          icon: 'TVMonitor',
          label: 'Big Picture'
        },
        logo:{
          icon: 'Font',
          label: 'Logo'
        },
        hero:{
          icon: 'Picture',
          label: 'Hero'
        }
      };
      return Object.keys(modes).map((key, i)=>{
        if(true){
        // if(key != this.state.arttype){
        //
          return (
            <AppBarButton
                icon={modes[key].icon}
                label={modes[key].label}
                labelPosition="right"
                onClick={this.changeMode(key)}
                style={(key == this.state.arttype ? { background: "rgba(0, 100, 180, 0.3)" } : {})}
            />
          );
        }
      });
    }


    commandBar(){
      return(
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                position: 'fixed',
                top: 30,
                width: 'calc(100vw - 55px)',
                height: 48,
                zIndex: 2
            }}
        >
          <AutoSuggestBox style={{marginLeft: 'auto', marginRight: 24}} placeholder='Search' onChangeValue={this.searchInput}/>
          {this.appBarButtons()}
          <AppBarSeparator style={{height: 24}} />
          <AppBarButton icon="Refresh" label="Refresh" onClick={this.refreshGames} />
        </div>
      );
    }

    render() {
        const {isLoaded, hasSteam, items} = this.state;

        if (!hasSteam) {
            return (
                <h5 style={{...this.context.theme.typographyStyles.title, textAlign: 'center'}}>
                    Steam installation not found.
                </h5>
            );
        }

        if (!isLoaded) {
            return <Spinner/>;
        }

        // renders redirect to search function
        if (this.state.toSearch) {
            return this.state.toSearch;
        }


        return (
            <div style={{height: 'inherit', overflow: 'hidden'}}>
                <TopBlur additionalHeight={48} />
                {this.commandBar()}
                <div id="grids-container" style={{height: '100%', overflow: 'auto', paddingTop: 64}}>
                    {Object.keys(items).map((platform) => (
                        <div key={platform} style={{paddingLeft: 10}}>
                            <div style={{
                                ...this.context.theme.typographyStyles.subTitleAlt,
                                display: 'inline-block',
                                position: 'sticky',
                                zIndex: 3,
                                marginLeft: 10,
                                top: -22
                            }}>
                                {this.platformNames[platform]}
                            </div>
                            <Grid
                                zoom={this.zoom}
                                platform={platform}
                            >
                                {items[platform].map((item) => {
                                    let image = {
                                      library: this.addNoCache(item.library_image),
                                      bigpicture: this.addNoCache(item.bigpicture_image),
                                      logo: this.addNoCache(item.logo_image),
                                      hero: this.addNoCache(item.hero_image),
                                    };
                                    let custom_applied = true;
                                    if(item.gameType=='shortcut' && !item.using_custom[arttype]){
                                      custom_applied = false;
                                      log.info(`no art for ${item.game}`)
                                    }
                                    return (
                                        // id attribute is used as a scroll target after a search
                                        <div id={`game-${item.appid}`} key={item.appid}>
                                            <GridImage
                                                name={item.name}
                                                gameId={item.gameId}
                                                platform={platform}
                                                appid={item.appid}
                                                steamid={item.steamid}
                                                arttype={this.state.arttype}
                                                gameType={item.type}
                                                image={image[this.state.arttype]}
                                                zoom={this.zoom}
                                                onGridClick={this.toSearch}
                                            />
                                        </div>
                                    );
                                })}
                            </Grid>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}

Games.propTypes = {
    location: PropTypes.object,
};
Games.contextTypes = { theme: PropTypes.object };
export default Games;
