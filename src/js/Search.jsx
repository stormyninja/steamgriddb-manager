import React from 'react';
import PropTypes from 'prop-types';
import { Redirect } from 'react-router-dom';
import Image from 'react-uwp/Image';
import Button from 'react-uwp/Button';
import PubSub from 'pubsub-js';
import TopBlur from './Components/TopBlur';
import Spinner from './Components/spinner';
import Steam from './Steam';

const SGDB = window.require('steamgriddb');
const log = window.require('electron-log');

class Search extends React.Component {
  constructor(props) {
    super(props);

    this.onClick = this.onClick.bind(this);
    this.SGDB = new SGDB('b971a6f5f280490ab62c0ee7d0fd1d16');

    const { location } = this.props;

    this.state = {
      game: location.state,
      items: [],
      toGame: false,
      isLoaded: false,
    };

    PubSub.publish('showBack', true);
  }

  componentDidMount() {
    const { game } = this.state;
    const { location } = this.props;

    let type = 'steam';
    let id;
    if (game.platform) {
      type = game.platform;
      id = game.gameId;
    } else {
      id = game.appid;
    }

    // Search for game name; not needed for platform games, but helps async flow
    this.SGDB.searchGame(game.name).then((res) => {
      if(game.platform == 'other'){
        if (res.length > 0){
          id = res[0].id;
          type = 'game';
          log.info(`Searching SGDB using title: ${res[0].name}`);
        }
        // if no response, don't search SDGB
        else {
          this.setState({
            isLoaded: true,
            items: [...this.getDefaultAsset(location.state.assetType, id, type)],
          });
          return;
        }
      }

      switch (location.state.assetType) {
      case 'horizontalGrid':
        this.SGDB.getGrids({ type, id }).then((res) => {
          this.setState({
            isLoaded: true,
            items: [...this.getDefaultAsset(location.state.assetType, id, type), ...res],
          });
        });
        break;
      case 'verticalGrid':
        this.SGDB.getGrids({ type, id, dimensions: ['600x900'] }).then((res) => {
          this.setState({
            isLoaded: true,
            items: [...this.getDefaultAsset(location.state.assetType, id, type), ...res],
          });
        });
        break;
      case 'hero':
        this.SGDB.getHeroes({ type, id }).then((res) => {
          this.setState({
            isLoaded: true,
            items: [...this.getDefaultAsset(location.state.assetType, id, type), ...res],
          });
        });
        break;
      case 'logo':
        this.setState({
          isLoaded: true,
          items: [...this.getDefaultAsset(location.state.assetType, id, type)],
        });
        break;
      default:
        break;
      }

    });


  }

  getDefaultAsset(assetType, id, type) {
    let assets = [];
    // if game has 'steamId', it is a shortcut - get default art for steam version
    if (this.state.game.steamId){
      type = 'steam';
      id = this.state.game.steamId;
      log.info(`${this.state.game.name} has steamid ${id}`)
    }
    if (type == 'steam') {
      const asset = Steam.getServerImage(assetType, id);
      assets.push({
          id: 0,
          url: asset,
          thumb: asset,
          style: 'default',
          title: this.state.game.name,
          author: {
            name: 'Official Steam Artwork',
            avatar: 'https://store.steampowered.com/favicon.ico'
          }
      });
    }
    return assets;
  }

  onClick(item, itemIndex) {
    const { game, items } = this.state;
    const { location } = this.props;

    const clonedItems = [...items];
    clonedItems[itemIndex].downloading = true;
    log.info(`Setting ${location.state.assetType} for game ${game.appid} to ${item.url}`);

    this.setState({
      items: clonedItems,
    });

    Steam.addAsset(location.state.assetType, game.appid, item.url).then(() => {
      clonedItems[itemIndex].downloading = false;
      this.setState({
        items: clonedItems,
      });
      this.setState({ toGame: <Redirect to={{ pathname: '/game', state: location.state }} /> });
    });
  }

  render() {
    const { isLoaded, toGame, items } = this.state;
    const { theme } = this.context;

    if (!isLoaded) {
      return <Spinner />;
    }

    if (toGame) {
      return toGame;
    }

    return (
      <>
        <TopBlur />
        <div
          id="search-container"
          style={{
            height: '100%',
            overflow: 'auto',
            padding: 15,
            paddingLeft: 10,
            paddingTop: 45,
          }}
        >
          {items.map((item, i) => (
            <Button
              key={item.id}
              style={{ padding: 0, margin: 5 }}
              onClick={() => this.onClick(item, i)}
            >
              {item.downloading ? (
                <div style={{ position: 'relative' }}>
                  <Spinner size={70} style={{ position: 'absolute', background: 'rgba(0,0,0,.5)' }} />
                  <Image
                    style={{
                      width: '100%',
                      height: 'auto',
                    }}
                    src={item.thumb}
                  />
                </div>
              ) : (
                <Image
                  style={{
                    width: '100%',
                    height: 'auto',
                  }}
                  src={item.thumb}
                />
              )}
              <p style={{ ...theme.typographyStyles.captionAlt, padding: 5 }}>
                <Image style={{ height: 20, marginRight: 5 }} src={item.author.avatar} />
                {item.author.name}
              </p>
            </Button>
          ))}
        </div>
      </>
    );
  }
}

Search.propTypes = {
  location: PropTypes.object.isRequired,
};
Search.contextTypes = { theme: PropTypes.object };
export default Search;
