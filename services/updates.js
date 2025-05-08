const simpleGit = require('simple-git');
const { CronJob } = require('cron');
const restartApp = require('./reloadApp.js');
const log = require('../log.js');
const { AUTO_UPDATE_SCHEDULE, EXTENDED_LOGS } = require('../../config.js').MAIN;

const git = simpleGit();

const pull = async () => {
	try {
		log('Resetting local repository to HEAD (--hard)...', 0, EXTENDED_LOGS);
		await git.reset(['--hard']);

		log('Pulling the repository and the required submodule...');
		const { summary } = await git.pull(['--recurse-submodules']);

		const { changes, insertions, deletions } = summary;
		if (changes > 0 || insertions > 0 || deletions > 0) {
			log(`Updates detected. Changes: ${changes}; Insertions: ${insertions}; Deletions: ${deletions}`, 0, true);
			return true;
		} else {
			log('No new updates detected', 1);
			return false;
		}
	} catch (err) {
		log(err, 3);
		return null;
	}
};

const pullAndRestart = async () => {
	try {
		const updatesAvailable = await pull();
		if (updatesAvailable) await restartApp();
	} catch (err) {
		log(err, 3);
	}
};

// https://crontab.guru
new CronJob(AUTO_UPDATE_SCHEDULE, pullAndRestart, null, true);

(async () => pullAndRestart())();