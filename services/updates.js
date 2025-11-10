const simpleGit = require('simple-git');
const semver = require('semver');
const { CronJob } = require('cron');
const path = require('node:path');
const restartApp = require('./reloadApp.js');
const logger = require('../logger.js');
const { SERVER_ID, AUTO_UPDATE_SCHEDULE, EXTENDED_LOGS } = require('../../config.js').MAIN;

const git = simpleGit();
const pkgPath = path.resolve(__dirname, '../../package.json');

const getLocalVersion = () => {
	delete require.cache[require.resolve(pkgPath)];
	return require(pkgPath).version;
};

const pull = async () => {
	try {
		if (SERVER_ID !== 'development') {
			if (EXTENDED_LOGS) logger.log('Resetting local repository to HEAD (--hard)...');
			await git.reset(['--hard']);
		}

		logger.log('Pulling the repository and the required submodule...');

		// Get submodule status before update
		const submoduleBefore = await git.raw(['submodule', 'status']);

		// Pull main repo and update submodules
		const pullResult = await git.pull();
		await git.submoduleUpdate(['--init', '--recursive', '--remote', '--merge']);

		// Get submodule status after update
		const submoduleAfter = await git.raw(['submodule', 'status']);
		const submoduleChanged = submoduleBefore !== submoduleAfter;

		const { changes, insertions, deletions } = pullResult.summary;
		const mainRepoChanged = changes > 0 || insertions > 0 || deletions > 0;
		const hasChanges = mainRepoChanged || submoduleChanged;
		if (hasChanges) {
			const parts = [];
			if (mainRepoChanged) parts.push(`Main repo - Changes: ${changes}; Insertions: ${insertions}; Deletions: ${deletions};`);
			if (submoduleChanged) parts.push('Submodule updated.');
			logger.log(`Updates pulled successfully. ${parts.join(' ')}`, 0, true);
		} else {
			logger.log('No new updates detected', 1);
		}

		return hasChanges;
	} catch (err) {
		logger.log(err.stack, 3);
		return null;
	}
};

const pullAndRestart = async () => {
	try {
		const oldVersion = getLocalVersion();
		const updatesAvailable = await pull();
		const newVersion = getLocalVersion();

		if (semver.neq(newVersion, oldVersion)) {
			logger.log(`Version changed: ${oldVersion} → ${newVersion}`, 1, true);
			await restartApp();
			return;
		}

		if (updatesAvailable) await restartApp();
	} catch (err) {
		logger.log(err.stack, 3);
	}
};

new CronJob(AUTO_UPDATE_SCHEDULE, pullAndRestart, null, true);
(async () => pullAndRestart())();