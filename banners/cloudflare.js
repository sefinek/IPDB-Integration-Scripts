const { authorEmailWebsite } = require('../repo.js');
const { color, reset, headerText, authorText, support } = require('./utils/helper.js');
const logger = require('../logger.js');

module.exports = header => {
	console.log(`
     ${color('255;160;0')}   .--.       ${headerText(header)}
     ${color('255;140;0')}.-(    ).     ${authorText(authorEmailWebsite)}
    ${color('255;120;0')}(___.__)__)${reset}
`);

	logger.log(support);
};