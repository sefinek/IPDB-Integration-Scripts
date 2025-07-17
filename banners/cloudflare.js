const { version, authorMeta, prettyName, license } = require('../repo.js');
const { color, reset, headerText, authorText, donate, sniffcat } = require('./utils/helper.js');
const logger = require('../logger.js');

module.exports = () => {
	console.log(`
     ${color('255;160;0')}   .--.       ${headerText(`Cloudflare WAF To ${prettyName} - v${version} `)}
     ${color('255;140;0')}.-(    ).     ${authorText(authorMeta)} [${license}]
    ${color('255;120;0')}(___.__)__)${reset}
`);

	logger.log(donate);
	logger.log(sniffcat);
};