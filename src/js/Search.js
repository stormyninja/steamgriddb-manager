import Spinner from './spinner.js';
import GridImage from './gridImage.js';
import {Redirect} from 'react-router-dom';
import Steam from './Steam.js';
import React from 'react';
import Image from 'react-uwp/Image';
import Grid from './Grid';
import TopBlur from './TopBlur';
import queryString from 'query-string';
import PropTypes from 'prop-types';
import PubSub from 'pubsub-js';
import {officialList} from './importers';
const SGDB = window.require('steamgriddb');
const Store = window.require('electron-store');
const log = window.require('electron-log');


class Search extends React.Component {
    constructor(props) {
        super(props);

        this.applyGrid = this.applyGrid.bind(this);
        this.zoom = 1;
        this.store = new Store();

        const qs = this.props.location && queryString.parse(this.props.location.search);
        this.game = qs.game;
        this.query = qs.game;
        this.appid = qs.appid;
        this.steamid = qs.steamid;
        this.gameType = qs.gameType;
        this.platform = qs.platform;
        this.gameId = qs.gameId;

        // this.styles = [];
        // this.styles.push(qs.styles);
        // this.dimensions = [];
        // this.dimensions.push(qs.dimensions);

        // override styles and dimensions using arttype param
        // eventually make customizeable from Games
        this.arttype = qs.arttype;
        log.info(`Search arttype: ${this.arttype}`);
        if(this.arttype == 'library'){
          this.styles = undefined;
          this.dimensions = ['600x900'];
        }
        // else if (this.arttype == 'bigpicture'){
        //   this.styles = undefined;
        //   this.dimensions = ['920x430','460x215'];
        // }
        // else if (this.arttype == 'hero'){
        //   this.styles = undefined;
        //   this.dimensions = ['1920x620', '3840x1240'];
        // }

        this.state = {
            error: null,
            arttype: props.arttype,
            apiError: false,
            isLoaded: false,
            isHover: false,
            isDownloading: false,
            imageDownloaded: false,
            items: []
        };

        this.setImageDownloaded = this.setImageDownloaded.bind(this);
        this.setIsDownloading = this.setIsDownloading.bind(this);
        this.getIsDownloading = this.getIsDownloading.bind(this);

        PubSub.publish('showBack', true);
    }

    componentDidMount() {
        if (this.state.items.length <= 0) {
            this.searchGrids();
        }
    }

    // @todo This should be it's own class so we can use it during one-click downloads
    searchGrids() {
        const client = new SGDB(process.env.STEAMGRIDDB_API_KEY);

        if (this.gameType === 'game') {
            const defaultGridImage = Steam.getDefaultGridImage(this.appid, this.arttype);
            const items = [{
                url: defaultGridImage,
                thumb: defaultGridImage,
                style: 'default',
                title: this.query,
                author: {
                    name: null
                }
            }];
            client.getGridsBySteamAppId(this.appid, this.styles, this.dimensions)
                .then((res) => {
                    this.setState({
                        isLoaded: true,
                        items: [...items, ...res]
                    });
                })
                .catch((err) => {
                    if (err.response.statusCode === 404) {
                        // Game not found is fine
                        this.setState({
                            isLoaded: true,
                            items: items
                        });
                    } else {
                        // Any other error is baad
                        this.setState({
                            apiError: true
                        });
                    }
                });
        }
        if (this.gameType === 'shortcut'){
          let items = [];
          if(this.steamid){
            const defaultGridImage = Steam.getDefaultGridImage(this.steamid, this.arttype);
            log.info(`default grid image: ${defaultGridImage}, arttype: ${this.arttype}`)
            items.push({
                url: defaultGridImage,
                thumb: defaultGridImage,
                style: 'default',
                title: this.query,
                author: {
                    name: null
                }
            });
          }
          // if game platform is from an 'official' importer in importers/
          if (officialList.includes(this.platform)) {
stt                  .then((grids) => {
                      this.setState({
                          isLoaded: true,
                          items: items.concat(grids)
                      });
                  })
                  .catch(() => {
                      this.setState({
                          apiError: true
                      });
                  });
          }
          else {
              client.searchGame(this.query).then((res) => {
                      client.getGridsById(res[0].id, this.styles, this.dimensions)
                          .then((grids) => {
                              this.setState({
                                  isLoaded: true,
                                  items: items.concat(grids)
                              });
                          });
                  }).catch(() => {
                      this.setState({
                          apiError: true
                      });
                  });
          }
        }
    }

    applyGrid(props) {
        if (this.getIsDownloading()) {
            return;
        }
        log.info(`Applying ${props.arttype} image to ${props.name} from ${props.image}`);
        this.setIsDownloading(true);
        Steam.addGrid(props.appid, props.gameType, props.image, props.arttype, (progress) => {
            this.setState({downloadProgress: progress});
            itemsClone[props.index].progress = progress;
            this.setState({itemsClone});
        }).then((dest) => {
            this.setImageDownloaded(props.appid, props.name, dest);
        }).catch(() => {
            this.setIsDownloading(false);
        });
    }

    setIsDownloading(isDownloading) {
        this.setState({isDownloading: isDownloading});
    }

    getIsDownloading() {
        return this.state.isDownloading;
    }

    setImageDownloaded(appid, game, image) {
        this.setState({
            imageDownloaded: {
                appid: appid,
                game: game,
                image: image
            },
            isDownloading: false
        });
    }

    render() {
        const {isLoaded, items} = this.state;

        if (this.state.imageDownloaded) {
            const url = `/?arttype=${this.arttype}&scrollto=${this.state.imageDownloaded.appid}`;

            // Show toast
            PubSub.publish('toast', {logoNode: 'Download', title: `Success: ${this.state.imageDownloaded.game}`, contents: (
                <Image
                    style={{width: '100%', marginTop: 10}}
                    src={this.state.imageDownloaded.image}
                />
            )});

            return (
                <div>
                    <Redirect to={url} />
                </div>
            );
        }

        if (!isLoaded) {
            return (<Spinner/>);
        }

        return (
            <>
                <TopBlur/>
                <div id="search-container" style={{height: '100%', overflow: 'auto', padding: 15, paddingLeft: 10, paddingTop: 45}}>
                    {this.state.apiError ? (
                        <div>
                            <h5 style={{...this.context.theme.typographyStyles.title, textAlign: 'center'}}>
                                Error trying to use the SteamGridDB API.
                            </h5>
                        </div>
                    ) : (
                        <Grid zoom={this.zoom}>
                            {items.map((item, i) => {
                                let progress = item.progress;
                                if (typeof item.progress == 'undefined') {
                                    progress = 0;
                                }
                                return (
                                    <GridImage
                                        key={i}
                                        index={i}
                                        appid={this.appid}
                                        steamid={this.steamid}
                                        arttype={this.arttype}
                                        gameType={this.gameType}
                                        name={this.game}
                                        author={item.author.name}
                                        image={item.thumb}
                                        zoom={this.zoom}
                                        progress={progress}
                                        onGridClick={this.applyGrid}
                                        data={item}
                                    />
                                );
                            })}
                        </Grid>
                    )}
                </div>
            </>
        );
    }
}

Search.propTypes = {
    location: PropTypes.object
};
Search.contextTypes = { theme: PropTypes.object };
export default Search;
