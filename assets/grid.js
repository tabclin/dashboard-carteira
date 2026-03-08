var dagcomponentfuncs = window.dashAgGridComponentFunctions = window.dashAgGridComponentFunctions || {};

dagcomponentfuncs.botaoObs = function(props) {

    return React.createElement(
        'button',
        {
            style: {
                backgroundColor: '#444',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px'
            },
            onClick: () => {
                props.setData(props.data)
            }
        },
        '📝'
    );
}