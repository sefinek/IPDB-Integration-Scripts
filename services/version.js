const semver = require('semver');
const { axiosGeneric } = require('./axios.js');
const { version, repoSlug } = require('../repo.js');
const logger = require('../logger.js');

const PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${repoSlug}/main/package.json`;

(async () => {
	logger.info('Checking for new versions...');

	try {
		const { data: { version: latest } } = await axiosGeneric.get(PACKAGE_JSON_URL);

		if (semver.gt(latest, version)) {
			logger.info(`A new version is available: v${version} → v${latest}. Please update.`, { discord: true });
		} else if (semver.gt(version, latest)) {
			logger.info(`Local version v${version} is ahead of remote v${latest}.`, { discord: true });
		}
	} catch (err) {
		logger.error(`Version check failed: ${err.stack}`);
	}
})();
