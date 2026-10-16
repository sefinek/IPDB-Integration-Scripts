const semver = require('semver');
const { CronJob } = require('cron');
const { axiosGeneric } = require('./axios.js');
const { version, repoSlug, repoUrl } = require('../repo.js');
const logger = require('../logger.js');

const PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${repoSlug}/main/package.json`;
const CHECK_SCHEDULE = '0 */12 * * *';

let notifiedVersion = null;

const checkForUpdates = async (startup = false) => {
	if (startup) logger.info('Checking for new versions...');

	try {
		const { data: { version: latest } } = await axiosGeneric.get(PACKAGE_JSON_URL);
		if (!semver.valid(latest)) throw new Error(`Invalid remote version: ${latest}`);

		if (semver.gt(latest, version)) {
			if (latest === notifiedVersion) return;

			notifiedVersion = latest;
			logger.info(`A new version is available! v${version} → v${latest}. Run 'npm run update' to update. Changes: ${repoUrl}/commits/main`, { discord: true });
		} else if (startup && semver.gt(version, latest)) {
			logger.info(`Local version v${version} is ahead of remote v${latest}`, { discord: true });
		}
	} catch (err) {
		logger.error(`Version check failed: ${err.message}`);
	}
};

(async () => {
	await checkForUpdates(true);
	new CronJob(CHECK_SCHEDULE, () => checkForUpdates(), null, true);
})();
