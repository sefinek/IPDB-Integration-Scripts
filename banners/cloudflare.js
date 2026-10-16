const { version, authorMeta, prettyName, license } = require('../core/repo.js');
const { color, reset, headerText, authorText, donate, sniffcat } = require('./utils/helper.js');
const logger = require('../core/logger.js');

module.exports = () => {
	console.log(`
     ${color('255;160;0')}   .--.       ${headerText(`Cloudflare WAF To ${prettyName} - v${version} `)}
     ${color('255;140;0')}.-(    ).     ${authorText(authorMeta)} [${license}]
    ${color('255;120;0')}(___.__)__)${reset}
`);

	logger.info(donate);
	logger.info(sniffcat);
};