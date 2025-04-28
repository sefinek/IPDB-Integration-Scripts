const simpleGit = require('simple-git');
const { CronJob } = require('cron');
const restartApp = require('./reloadApp.js');
const log = require('../utils/log.js');
const { AUTO_UPDATE_SCHEDULE, EXTENDED_LOGS } = require('../../config.js').MAIN;

const git = simpleGit();

const pull = async () => {
	log('Pulling repository and submodules...', 0, EXTENDED_LOGS);

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
		if (changes > 0 || insertions > 0 || deletions > 0) {
			log(`Updates detected. Changes: ${changes}; Insertions: ${insertions}; Deletions: ${deletions}`, 0, true);
			await restartApp();
		} else {
			log('No new updates detected', 1);
		}
	} catch (err) {
		log(err, 3);
	}
};

// https://crontab.guru
new CronJob(AUTO_UPDATE_SCHEDULE, pullAndRestart, null, true);

module.exports = pullAndRestart;