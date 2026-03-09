var dagcomponentfuncs = window.dashAgGridComponentFunctions = window.dashAgGridComponentFunctions || {};

dagcomponentfuncs.botaoObs = function(props) {

    function click() {
        props.setData(props.data);
    }

    return React.createElement(
        'span',
        {
            style: {
                cursor: 'pointer',
                fontSize: '18px'
            },
            onClick: click
        },
        '📝'
    );
}