const simpleGit = require('simple-git');
const { CronJob } = require('cron');
const restartApp = require('./reloadApp.js');
const log = require('../utils/log.js');
const { AUTO_UPDATE_SCHEDULE } = require('../../config.js').MAIN;

const git = simpleGit();

const pull = async () => {
	log('Pulling repository and submodules...', 0, true);

	try {
		const { summary } = await git.pull(['--recurse-submodules']);
		return summary;
	} catch (err) {
		log(err, 3);
		return null;
	}
};

const pullAndRestart = async () => {
	try {
		const result = await pull();
		if (!result) return;

		const { changes, insertions, deletions } = result;
		const hasUpdates = changes > 0 || insertions > 0 || deletions > 0;

		if (hasUpdates) {
			log(`Main repo - Changes: ${changes}; Deletions: ${deletions}; Insertions: ${insertions}`, 1, true);
			log('Updates detected, restarting app...', 1, true);

			await restartApp();
		} else {
			log('No updates detected.', 1, true);
		}
	} catch (err) {
		log(err, 3);
	}
};

// https://crontab.guru
new CronJob(AUTO_UPDATE_SCHEDULE, pullAndRestart, null, true);

module.exports = pullAndRestart;