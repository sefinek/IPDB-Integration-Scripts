const { version, authorMeta, prettyName, repoUrl, license } = require('../repo.js');
const { color, reset, headerText, authorText, donate, sniffcat } = require('./utils/helper.js');
const logger = require('../logger.js');

module.exports = () => {
	console.log(`
  ${color('255;140;0')}██╗   ██╗ ███████╗ ██╗    ██╗
  ${color('255;120;0')}██║   ██║ ██╔════╝ ██║    ██║    ${headerText(`UFW To ${prettyName} - v${version}`)}
  ${color('255;100;0')}██║   ██║ █████╗   ██║ █╗ ██║    ${authorText(authorMeta)}
  ${color('255;80;0')}██║   ██║ ██╔══╝   ██║███╗██║    ${repoUrl} ${authorText(`[${license}]`)}
  ${color('255;70;0')}╚██████╔╝ ██║      ╚███╔███╔╝
  ${color('255;40;0')} ╚═════╝  ╚═╝       ╚══╝╚══╝${reset}
`);

	logger.info(donate);
	logger.info(sniffcat);
};
