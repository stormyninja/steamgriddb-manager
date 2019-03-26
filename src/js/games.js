import React from 'react';
import Spinner from './spinner.js';
import GridImage from './gridImage.js';
import queryString from 'query-string';
import Image from "react-uwp/Image";
import Grid from "./Grid";
import * as PubSub from "pubsub-js";
import Steam from "./Steam";

class Games extends React.Component {
    constructor(props) {
        super(props);

        this.zoom = 1;

        this.state = {
            error: null,
            isLoaded: false,
            isHover: false,
            toSearch: false,
            items: []
        };


        const qs = this.props.location && queryString.parse(this.props.location.search);

        if (qs.success) {
            this.state.success = {
                game: qs.game,
                image: qs.image
            }
        }
    }

    componentDidMount() {
        if (this.state.items.length <= 0) {
            this.fetchGames();
        }
    }

    fetchGames() {
        let self = this;

        let steamGamesPromise = Steam.getSteamGames();
        let nonSteamGamesPromise = Steam.getNonSteamGames();

        Promise.all([steamGamesPromise, nonSteamGamesPromise]).then((values) => {
            let items =  [].concat.apply([], values);

            self.setState({
                isLoaded: true,
                items: items
            });
        });
    }

    onClick() {
        this.setState({toSearch: true});
    }

    addNoCache(imageURI) {
        if (!imageURI) {
            return false;
        }

        return `${imageURI}?${(new Date().getTime())}`;
    }

    render() {
        const {isLoaded, items} = this.state;

        if (this.state.success) {
            let title = `Success: ${this.state.success.game}`;

            PubSub.publish('toast', {logoNode: 'Download', title: title, contents: (
                <Image
                    style={{width: "100%", marginTop: 10}}
                    src={this.addNoCache(this.state.success.image)}
                />
            )});
        }

        if (!isLoaded) {
            return <Spinner/>
        }

        return (
            <Grid zoom={this.zoom}>
                {items.map((item, i) => {
                    let imageURI = this.addNoCache((item.imageURI));

                    return (
                        <GridImage name={item.name} appid={item.appid} gameType={item.type} image={imageURI} zoom={this.zoom} onClick={this.onClick} key={i}/>
                    )
                })}
            </Grid>
        )
    }
}

export default Games;
