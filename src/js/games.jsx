import React from 'react';
import PropTypes from 'prop-types';
import { Redirect } from 'react-router-dom';
import AutoSuggestBox from 'react-uwp/AutoSuggestBox';
import AppBarButton from 'react-uwp/AppBarButton';
import AppBarSeparator from 'react-uwp/AppBarSeparator';
import Separator from 'react-uwp/Separator';
import Fuse from 'fuse.js';
import PubSub from 'pubsub-js';
import { debounce } from 'lodash';
import { forceCheck } from 'react-lazyload';
import Spinner from './Components/spinner';
import Steam from './Steam';
import TopBlur from './Components/TopBlur';
import GameListItem from './Components/Games/GameListItem';
import platformModules from './importers';

const log = window.require('electron-log');

class Games extends React.Component {
  constructor(props) {
    super(props);
    this.toGame = this.toGame.bind(this);
    this.refreshGames = this.refreshGames.bind(this);
    this.filterGames = this.filterGames.bind(this);
    this.searchInput = debounce((searchTerm) => {
      this.filterGames(searchTerm);
    }, 300);


    this.appBarButtons = this.appBarButtons.bind(this);
    this.commandBar = this.commandBar.bind(this);
    this.modes = ['library','bigpicture','hero','logo'];
    if(process.platform == 'darwin'){
      log.info('Using MacOS');
    }
    if(process.platform == 'win32'){
      log.info('Using Windows');
    }

    this.zoom = 1;

    // Fetched games are stored here and shouldn't be changed unless a fetch is triggered again
    this.fetchedGames = {};
    this.platformNames = {
      steam: 'Steam',
      other: 'Other Games',
    };

    Object.keys(platformModules).forEach((module) => {
      this.platformNames[platformModules[module].id] = platformModules[module].name;
    });

    this.state = {
      isLoaded: false,
      toGame: false,
      hasSteam: true,
      displayMode: 'list',
      items: {},
    };
  }

  componentDidMount() {
    log.info("component did mount");
    const { items } = this.state;
    log.info(items);

    PubSub.publish('showBack', true);

    if (Object.entries(items).length <= 0) {
      Steam.getSteamPath().then(() => {
        this.fetchGames();
      }).catch(() => {
        log.warn('Steam is not installed');
        this.setState({ hasSteam: false });
      });
    }
  }

  fetchGames() {
    const steamGamesPromise = Steam.getSteamGames();
    const nonSteamGamesPromise = Steam.getNonSteamGames();
    Promise.all([steamGamesPromise, nonSteamGamesPromise]).then((values) => {
      const items = { steam: values[0], ...values[1] };
      // Sort games alphabetically
      Object.keys(items).forEach((platform) => {
        items[platform] = items[platform].sort((a, b) => {
          if (a.name > b.name) {
            return 1;
          }

          return ((b.name > a.name) ? -1 : 0);
        });
      });

      this.fetchedGames = items;
      this.setState({
        isLoaded: true,
        items,
      });
    });
  }

  toGame(platform, index) {
    const { items } = this.state;
    const data = items[platform][index];
    this.setState({
      toGame: <Redirect to={{ pathname: '/game', state: data }} />,
    });
  }

  refreshGames() {
    this.setState({ isLoaded: false });
    this.fetchGames();
  }

  filterGames(searchTerm) {
    const items = { ...this.fetchedGames };
    if (searchTerm.trim() === '') {
      this.setState({ items });
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
          'name',
        ],
      });
      items[platform] = fuse.search(searchTerm);
    });
    this.setState({ items });

    forceCheck(); // Recheck lazyload
  }

  changeMode = arttype => () => {
      this.setState({
          isLoaded: false,
          arttype: arttype
      });
      this.fetchGames();
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
    const {
      isLoaded,
      hasSteam,
      items,
      toGame,
    } = this.state;
    const { theme } = this.context;

    if (!hasSteam) {
      return (
        <h5 style={{ ...theme.typographyStyles.title, textAlign: 'center' }}>
          Steam installation not found.
        </h5>
      );
    }

    if (!isLoaded) {
      return <Spinner />;
    }

    if (toGame) {
      return toGame;
    }

    return (
      <div style={{ height: 'inherit', overflow: 'hidden' }}>
        <TopBlur additionalHeight={48} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'fixed',
            top: 30,
            width: 'calc(100vw - 55px)',
            height: 48,
            zIndex: 2,
          }}
        >
          <AutoSuggestBox style={{ marginLeft: 'auto', marginRight: 24 }} placeholder="Search" onChangeValue={this.searchInput} />
          <AppBarSeparator style={{ height: 24 }} />
          <AppBarButton
            icon="Refresh"
            label="Refresh"
            onClick={this.refreshGames}
          />
        </div>
        <div id="grids-container" style={{ height: '100%', overflow: 'auto', paddingTop: 64 }}>
          {Object.keys(items).map((platform) => {
            if(this.state.displayMode == 'list') {
              return (
                <GameListItem
                  key={platform}
                  platform={platform}
                  platformName={this.platformNames[platform]}
                  listSource={[
                    ...items[platform].map((item) => <p key={item.appid} id={`game-${item.appid}`} game={item}>{item.name}</p>),
                    <Separator disabled />,
                  ]}
                  onItemClick={this.toGame}
                />
              )
            }
          })}
        </div>
      </div>
    );
  }
}

Games.contextTypes = { theme: PropTypes.object };
export default Games;
