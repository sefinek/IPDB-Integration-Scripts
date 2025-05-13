const { authorEmailWebsite } = require('../repo.js');
const { color, headerText, authorText, reset } = require('./utils/helper.js');

module.exports = header => `\n\
     ${color('255;160;0')}   .--.       ${headerText(header)}
     ${color('255;140;0')}.-(    ).     ${authorText(authorEmailWebsite)}
    ${color('255;120;0')}(___.__)__)${reset}
`;