import React from 'react';
import PropTypes from 'prop-types';
import { Redirect } from 'react-router-dom';
import Image from 'react-uwp/Image';
import Button from 'react-uwp/Button';
import PubSub from 'pubsub-js';
import TopBlur from './Components/TopBlur';
import Steam from './Steam';
import heroPlaceholder from '../img/hero_none.png';
import capsuleVerticalPlaceholder from '../img/capsule_vertical_none.png';
import capsulePlaceholder from '../img/capsule_none.png';

const { join } = window.require('path');
const fs = window.require('fs');
const log = window.require('electron-log');

class Game extends React.Component {
  constructor(props) {
    super(props);
    this.toSearch = this.toSearch.bind(this);

    const { location } = this.props;
    let images = {
      grid: null,
      poster: null,
      hero: null,
      logo: null,
    }
    this.state = {
      game: location.state,
      toSearch: false,
      images: images,
    };

    PubSub.publish('showBack', true);
  }

  componentDidMount() {
    const { game } = this.state;
    const self = this;

    Steam.getSteamPath().then((steamPath) => {
      Steam.getLoggedInUser().then((user) => {
        // Get custom images if they exists
        const userdataGridPath = join(steamPath, 'userdata', String(user), 'config', 'grid');
        const custom_images = Steam.getCustomImages(userdataGridPath, game.appid);

        // Find defaults from the cache if it doesn't exist
        const librarycachePath = join(steamPath, 'appcache', 'librarycache');
        const default_images = Steam.getCachedImages(librarycachePath, game.appid);

        // Prioritize custom over default
        let images = {};
        Object.keys(custom_images).forEach((key) => {
          images[key] = custom_images[key] ? custom_images[key] : default_images[key];
        });
        self.setState({
          images: {
            grid: images['horizontalGrid'],
            poster: images['verticalGrid'],
            hero: images['hero'],
            logo: images['logo'],
          }
        });
      });
    });
  }

  toSearch(assetType) {
    const { location } = this.props;
    this.setState({ toSearch: <Redirect to={{ pathname: '/search', state: { ...location.state, assetType } }} /> });
  }

  addNoCache(imageURI) {
    if (!imageURI) {
      return false;
    }

    return `${imageURI}?${(new Date().getTime())}`;
  }

  render() {
    const {
      toSearch,
      game,
      images,
    } = this.state;
    if (toSearch) {
      return toSearch;
    }

    const { theme } = this.context;
    const titleStyle = {
      ...theme.typographyStyles.subTitle,
      padding: '20px 0px 10px 0',
      width: '100%',
    };
    const buttonStyle = {
      padding: 0,
    };

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
          <h1 style={theme.typographyStyles.header}>{game.name}</h1>
          <h5 style={titleStyle}>Hero</h5>
          <Button style={buttonStyle} onClick={() => this.toSearch('hero')}>
            <Image
              style={{
                width: '100%',
                height: 'auto',
              }}
              src={this.addNoCache(images.hero) || heroPlaceholder}
            />
          </Button>

          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1 }}>
              <h5 style={titleStyle}>Vertical Capsule</h5>
              <Button style={buttonStyle} onClick={() => this.toSearch('verticalGrid')}>
                <Image
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                  }}
                  src={this.addNoCache(images.poster) || capsuleVerticalPlaceholder}
                />
              </Button>
            </div>
            <div
              style={{
                marginLeft: 10,
                flex: 1,
              }}
            >
              <h5 style={titleStyle}>Horizontal Capsule</h5>
              <Button style={buttonStyle} onClick={() => this.toSearch('horizontalGrid')}>
                <Image
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                  }}
                  src={this.addNoCache(images.grid) || capsulePlaceholder}
                />
              </Button>
            </div>
          </div>
          <div>
            <h5 style={titleStyle}>Logo</h5>
            <Button style={buttonStyle} onClick={() => this.toSearch('logo')}>
              <Image
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                }}
                src={this.addNoCache(images.logo) || capsulePlaceholder}
              />
            </Button>
          </div>
        </div>
      </>
    );
  }
}

Game.propTypes = {
  location: PropTypes.object.isRequired,
};
Game.contextTypes = { theme: PropTypes.object };
export default Game;
