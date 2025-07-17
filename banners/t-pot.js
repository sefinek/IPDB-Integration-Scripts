const { version, authorMeta, prettyName, repoUrl, license } = require('../repo.js');
const { color, reset, donate, sniffcat } = require('./utils/helper.js');
const logger = require('../logger.js');

module.exports = () => {
	console.log(`
  ${color('255;0;130')} _____   ____       _       
  ${color('235;0;120')}|_   _| |  _ \\ ___ | |_     ${color('235;0;120')}T${color('235;0;120')}-${color('235;0;120')}Pot To ${prettyName} - v${version}
  ${color('215;0;110')}  | |   | |_) / _ \\| __|    ${color('235;0;120')}${authorMeta}
  ${color('195;0;95')}  | |   |  __/ (_) | |_     ${repoUrl} [${license}]
  ${color('175;0;85')}  |_|   |_|   \\___/ \\__|${reset}
`);

	logger.log(donate);
	logger.log(sniffcat);
};
