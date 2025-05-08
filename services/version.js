const axios = require('./axios.js');
const { version, authorAndName } = require('../repo.js');
const log = require('../log.js');

const PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${authorAndName}/main/package.json`;

(async () => {
	log('Checking for new versions...');

	try {
		const { data: { version: latest } } = await axios.get(PACKAGE_JSON_URL);
		if (latest !== version) {
			log(`A new version is available! Update by running 'npm run pull', or set 'AUTO_UPDATE_ENABLED' to true and restart the process.\n> ${version} → ${latest}`, 0, true);
		}
	} catch (err) {
		log(`Failed to check version: ${err.stack}`, 3, true);
	}
})();