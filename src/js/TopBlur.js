import React from 'react';
import PropTypes from 'prop-types';
import UWPNoise from '../img/uwp-noise.png';

class TopBlur extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                height: 30+this.props.additionalHeight,
                width: '100%',
                backgroundColor: 'rgba(0,0,0,.2)',
                backgroundImage: `url(${UWPNoise})`,
                backdropFilter: 'blur(20px)',
                zIndex: 2
            }}/>
        );
    }
}

TopBlur.propTypes = {
    additionalHeight: PropTypes.number.isRequired
};

TopBlur.defaultProps = {
    additionalHeight: 0
};

export default TopBlur;
