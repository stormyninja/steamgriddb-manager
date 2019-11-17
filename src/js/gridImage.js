import React from 'react';
import ProgressBar from 'react-uwp/ProgressBar';
import {CSSTransitionGroup} from 'react-transition-group';
import PropTypes from 'prop-types';
const ReactLazyLoad = require('react-lazyload').default;

class GridImage extends React.Component {
    constructor(props) {
        super(props);
        this.zoom = this.props.zoom;
        let sizes = {
          library:{
            width: 600 * this.zoom,
            height: 900 * this.zoom,
            scale: 3
          },
          bigpicture:{
            width: 460 * this.zoom,
            height: 215 * this.zoom,
            scale:1.5
          },
          logo:{
            width: 640 * this.zoom,
            height: 360 * this.zoom,
            scale: 2
          },
          hero:{
            width: 1920 * this.zoom,
            height: 620 * this.zoom,
            scale: 6
          },
          storepage:{
            width: 1438 * this.zoom,
            height: 809 * this.zoom,
            scale: 4
          }
        }

        this.gridWidth = sizes[this.props.arttype].width * this.zoom / sizes[this.props.arttype].scale;
        this.gridHeight = sizes[this.props.arttype].height * this.zoom / sizes[this.props.arttype].scale;

        this.onGridClick = this.props.onGridClick;
        this.handleClick = this.handleClick.bind(this);
    }

    shouldComponentUpdate(nextProps) {
        return !(this.props.progress === nextProps.progress);
    }

    handleClick() {
        this.onGridClick(this.props);
    }

    render() {
        let progressBar = <div></div>;
        if (this.props.progress) {
            progressBar = (
                <div style={{
                    position: 'absolute',
                    width: `${this.gridWidth}px`,
                    bottom: '24px'
                }}>
                    <ProgressBar
                        defaultProgressValue={this.props.progress}
                        barWidth={this.gridWidth}
                    />
                </div>
            );
        }


        let image = '';
        if (this.props.image) {
            image = (
                <ReactLazyLoad
                    height={this.gridHeight}
                    overflow
                    resize
                    once
                >
                    <CSSTransitionGroup key="1"
                        style={{display: 'flex'}}
                        transitionName="grid-fadein"
                        transitionAppear={true}
                        transitionAppearTimeout={1000}
                        transitionEnter={false}
                        transitionLeave={false}>
                        <img key="1" style={{
                            width: `${this.gridWidth}px`,
                            height: `${this.gridHeight}px`
                        }} src={this.props.image} />
                    </CSSTransitionGroup>
                </ReactLazyLoad>
            );
        }

        return (
            <div
                className="grid-wrapper"
                style={{
                    margin: 5,
                    position: 'relative',
                    width: `${this.gridWidth}px`
                }}
                onClick={this.handleClick}
            >
                {image}

                <div style={{
                    ...this.context.theme.typographyStyles.base,
                    fontWeight: 400,
                    padding: 5,
                    height: 30,
                    width: '100%',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    zIndex: 0
                }}>
                    {this.props.name}
                </div>

                <div
                    className="grid-overlay"
                    style={{
                        width: `${this.gridWidth}px`,
                        height: `${this.gridHeight}px`
                    }}
                >
                    {this.props.author &&
                        <span>Grid by: {this.props.author}</span>
                    }
                </div>

                {progressBar}
            </div>
        );
    }
}

GridImage.propTypes = {
    name: PropTypes.string,
    appid: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    alt_appid: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    steamid: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    arttype: PropTypes.oneOfType([
        PropTypes.string,
    ]),    index: PropTypes.number,
    gameType: PropTypes.string,
    gameId: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    platform: PropTypes.string,
    author: PropTypes.string,
    zoom: PropTypes.number,
    progress: PropTypes.number,
    image: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.bool
    ]),
    onGridClick: PropTypes.func
};
GridImage.contextTypes = { theme: PropTypes.object };

export default GridImage;
