const simpleGit = require('simple-git');
const semver = require('semver');
const { CronJob } = require('cron');
const path = require('node:path');
const restartApp = require('./reloadApp.js');
const logger = require('../logger.js');
const { SERVER_ID, AUTO_UPDATE_SCHEDULE, EXTENDED_LOGS } = require('../../config.js').MAIN;

const repoRoot = path.resolve(__dirname, '../../');
const pkgPath = path.resolve(repoRoot, 'package.json');
const git = simpleGit(repoRoot);

const getLocalVersion = () => {
	delete require.cache[require.resolve(pkgPath)];
	return require(pkgPath).version;
};

const pull = async () => {
	try {
		if (SERVER_ID !== 'development') {
			if (EXTENDED_LOGS) logger.info('Resetting local repository to HEAD (--hard)...');
			await git.reset(['--hard']);
		}

		logger.info('Pulling the repository and submodules...');

		const pullResult = await git.pull('origin', 'main');
		await git.submoduleUpdate(['--init', '--recursive']);

		const { changes, insertions, deletions } = pullResult.summary;
		const hasChanges = changes > 0 || insertions > 0 || deletions > 0;
		if (hasChanges) {
			logger.info(`Updates pulled successfully! Changes: ${changes}, +${insertions}/-${deletions}`, { discord: true });
		} else {
			logger.success('No new updates detected');
		}

		return hasChanges;
	} catch (err) {
		logger.error(err.stack);
		return null;
	}
};

const pullAndRestart = async () => {
	try {
		const oldVersion = getLocalVersion();
		const updatesAvailable = await pull();
		const newVersion = getLocalVersion();

		if (semver.neq(newVersion, oldVersion)) {
			logger.success(`Version changed: ${oldVersion} -> ${newVersion}`, { discord: true });
			await restartApp();
			return;
		}

		if (updatesAvailable) await restartApp();
	} catch (err) {
		logger.error(err.stack);
	}
};

new CronJob(AUTO_UPDATE_SCHEDULE, pullAndRestart, null, true);
(async () => pullAndRestart())();
