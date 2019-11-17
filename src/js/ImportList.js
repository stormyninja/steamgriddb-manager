import React from 'react';
import ListView from 'react-uwp/ListView';
import PropTypes from 'prop-types';
import ImportListItem from './ImportListItem';
const log = window.require('electron-log');


class ImportList extends React.Component {
    constructor(props) {
        super(props);

        this.games = this.props.games;
        this.grids = this.props.grids;
        this.platform = this.props.platform;
        this.onImportClick = this.props.onImportClick;
        this.onChangeAlt = this.props.onChangeAlt;
    }

    render() {
        log.info("RENDERING IMPORTLIST");
        const listStyle = {
            background: 'none',
            border: 0,
            width: '100%',
            marginBottom: 10,
            clear: 'both'
        };

        const importList = (
            this.games.map((game, i) => {
                let thumb = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkqAcAAIUAgUW0RjgAAAAASUVORK5CYII=';
                let image = null;
                const gamegrids = this.grids[game.id];
                if (gamegrids) {
                    thumb = gamegrids.steam.thumb || gamegrids.db.thumb || thumb;
                    image = gamegrids.steam.bigpicture || gamegrids.db.bigpicture || null;
                }

                let progress = game.progress;
                if (typeof game.progress == 'undefined') {
                    progress = 0;
                }

                let use_alt = game.use_alt;
                game['idx'] = i;

                return (
                    <ImportListItem
                        key={this.games.id}
                        progress={progress}
                        use_alt={use_alt}
                        image={image}
                        thumb={thumb}
                        game={game}
                        platform={this.platform}
                        onChangeAlt={this.onChangeAlt}
                        onImportClick={this.onImportClick}
                    />
                );
            })
        );

        return (
            <ListView style={listStyle} listSource={importList}/>
        );
    }
}

ImportList.propTypes = {
    games: PropTypes.array.isRequired,
    grids: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.bool
    ]).isRequired,
    platform: PropTypes.object.isRequired,
    onImportClick: PropTypes.func
};

export default ImportList;
