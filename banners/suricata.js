const { version, authorMeta, prettyName, repoUrl, license } = require('../repo.js');
const { color, reset, headerText, authorText, donate } = require('./utils/helper.js');
const logger = require('../logger.js');

module.exports = () => {
	console.log(`
   ${color('255;140;0')}  /\\_/\\
   ${color('255;120;0')} ( o.o )      ${headerText(`Suricata To ${prettyName} - v${version}`)}
   ${color('255;100;0')}  > ^ <       ${authorText(authorMeta)}
   ${color('255;80;0')} /     \\      ${authorText(`${repoUrl} [${license}]`)}
   ${color('255;70;0')}(       )
   ${color('255;40;0')} \\__|__/${reset}
`);

	logger.log(donate);
};
