const { authorEmailWebsite } = require('../repo.js');
const { color, reset, headerText, authorText, support } = require('./utils/helper.js');
const logger = require('../logger.js');

module.exports = header => {
	console.log(`
   ${color('255;140;0')}  /\\_/\\
   ${color('255;120;0')} ( o.o )      ${headerText(header)}
   ${color('255;100;0')}  > ^ <       ${authorText(authorEmailWebsite)}
   ${color('255;80;0')} /     \\      ${authorText('GPL-3.0 License')}
   ${color('255;70;0')}(       )
   ${color('255;40;0')} \\__|__/${reset}
`);

	logger.log(support);
};
