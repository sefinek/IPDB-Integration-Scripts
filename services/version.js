const semver = require('semver');
const axios = require('./axios.js');
const { version, authorAndName } = require('../repo.js');
const log = require('../log.js');

const PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${authorAndName}/main/package.json`;

(async () => {
	log('Checking for new versions...');

	try {
		const { data: { version: latest } } = await axios.get(PACKAGE_JSON_URL);

		if (semver.gt(latest, version)) {
			log(`A new version is available: v${version} → v${latest}. Please update.`, 0, true);
		} else if (semver.gt(version, latest)) {
			log(`Local version v${version} is ahead of remote v${latest}.`, 0, true);
		}
	} catch (err) {
		log(`Version check failed: ${err.stack}`, 3, true);
	}
})();