var dagcomponentfuncs = window.dashAgGridComponentFunctions = window.dashAgGridComponentFunctions || {};

dagcomponentfuncs.botaoObs = function(props) {

    function clicar() {

        const payload = {
            Paciente: props.data.Paciente,
            "Observação": props.data["Observação"]
        };

        props.setData(payload);
    }

    return React.createElement(
        'span',
        {
            style: {
                cursor: 'pointer',
                fontSize: '18px'
            },
            onClick: clicar
        },
        '📝'
    );
}