import React from 'react';
import Image from 'react-uwp/Image';
import Button from 'react-uwp/Button';
import ProgressBar from 'react-uwp/ProgressBar';
import PropTypes from 'prop-types';
const log = window.require('electron-log');

class ImportListItem extends React.Component {
    constructor(props) {
        super(props);
        this.image = this.props.image;
        this.thumb = this.props.thumb;
        this.game = this.props.game;
        this.platform = this.props.platform;
        this.handleClick = this.handleClick.bind(this);
        this.changeAltClick = this.changeAltClick.bind(this);
    }

    shouldComponentUpdate(nextProps) {
      return !(this.props.progress === nextProps.progress) || !(this.props.use_alt === nextProps.use_alt);
    }

    handleClick() {
        this.props.onImportClick(this.game, this.image, this.platform);
    }
    changeAltClick() {
        this.props.onChangeAlt(this.game);
    }

    render() {
        let progressBar = <div></div>;
        if (this.props.progress && this.props.progress !== 1) {
            progressBar = <ProgressBar style={{display: 'block', 'width': '100%'}} defaultProgressValue={this.game.progress} />;
        }

        let name = <div></div>;
        if(this.game.alt_name != null){
          if(!this.props.use_alt){
            name = <p><b>{this.game.name}</b> or {this.game.alt_name}</p>;
          }
          else {
            name = <p>{this.game.name} or <b>{this.game.alt_name}</b></p>;
          }
        }
        else {
          name = <p>{this.game.name}</p>;
        }

        let altButton = <div></div>;
        if (this.game.alt_name != null){
          altButton = <Button style={{opacity: 0, marginLeft: 'auto'}} onClick={this.changeAltClick}>Use Alt Name</Button>;
        }

        return (
            <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', width: 'inherit'}} key={this.game.id}>
                <Image
                    style={{marginRight: 10}}
                    height='30px'
                    width='64px'
                    src={this.thumb}
                />
                {name}
                {altButton}
                <Button style={{opacity: 0, marginLeft: 'auto'}} onClick={this.handleClick}>Import</Button>
                {progressBar}
            </div>
        );
    }
}

ImportListItem.propTypes = {
    platform: PropTypes.object.isRequired,
    game: PropTypes.object.isRequired,
    progress: PropTypes.number,
    image: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.bool
    ]),
    thumb: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.bool
    ]),
    onImportClick: PropTypes.func
};

export default ImportListItem;
