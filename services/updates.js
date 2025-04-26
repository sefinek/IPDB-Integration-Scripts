const simpleGit = require('simple-git');
const { CronJob } = require('cron');
const restartApp = require('./reloadApp.js');
const log = require('../utils/log.js');
const { AUTO_UPDATE_SCHEDULE } = require('../../config.js').MAIN;
const git = simpleGit();

const pull = async () => {
	log('Pulling the repository and submodules...');

	let mainSummary;
	try {
		const result = await git.pull(['--recurse-submodules']);
		mainSummary = result.summary;
	} catch (err) {
		log(err, 3);
		return null;
	}

	return { mainSummary, submoduleChanges: false };
};

const pullAndRestart = async () => {
	try {
		const result = await pull();
		if (!result) return;

		const { mainSummary, submoduleChanges } = result;
		const { changes, insertions, deletions } = mainSummary;

		const hasUpdates = (changes > 0 || insertions > 0 || deletions > 0 || submoduleChanges);
		if (hasUpdates) {
			log(`Main repo - Changes: ${changes}; Deletions: ${deletions}; Insertions: ${insertions}`, 1, true);
			if (submoduleChanges) log('Detected updates in submodules', 1, true);

			log('Updates detected (main repo or submodules), restarting app...', 1, true);
			await restartApp();
		} else {
			log('Great! No new updates detected.', 1, true);
		}
	} catch (err) {
		log(err, 3);
	}
};

// https://crontab.guru
new CronJob(AUTO_UPDATE_SCHEDULE, pullAndRestart, null, true);

module.exports = pullAndRestart;