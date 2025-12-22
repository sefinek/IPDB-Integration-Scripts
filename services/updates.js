const fs = require('node:fs');
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

const SUBMODULE_BRANCHES = (() => {
	try {
		const file = path.join(repoRoot, '.gitmodules');
		if (!fs.existsSync(file)) return {};
		// test2
		const lines = fs.readFileSync(file, 'utf8').split('\n');
		const map = {};
		let current = null;

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line) continue;

			const sectionMatch = line.match(/^\[submodule "(.*)"\\]/);
			if (sectionMatch) {
				if (current?.path) map[current.path] = current.branch || 'main';
				current = { name: sectionMatch[1], branch: 'main' };
				continue;
			}

			if (!current) continue;
			const pathMatch = line.match(/^path\s*=\s*(.+)$/);
			if (pathMatch) {
				current.path = pathMatch[1].trim();
				continue;
			}
			const branchMatch = line.match(/^branch\s*=\s*(.+)$/);
			if (branchMatch) {
				current.branch = branchMatch[1].trim();
			}
		}

		if (current?.path) map[current.path] = current.branch || 'main';
		return map;
	} catch {
		return {};
	}
})();

const getLocalVersion = () => {
	delete require.cache[require.resolve(pkgPath)];
	return require(pkgPath).version;
};

const ensureSubmodulesOnMain = async statusOutput => {
	const detached = statusOutput
		.split('\n')
		.map(line => line.trim())
		.filter(line => line && line.includes('detached'))
		.map(line => {
			const match = line.match(/^[+-]?[\da-f]{40}\s+(\S+)/);
			return match ? match[1] : null;
		})
		.filter(Boolean);

	if (!detached.length) return false;

	for (const submodulePath of detached) {
		const targetBranch = SUBMODULE_BRANCHES[submodulePath] || 'main';
		const subGit = simpleGit(path.join(repoRoot, submodulePath));
		logger.warn(`Submodule "${submodulePath}" is detached. Checking out "${targetBranch}"...`);
		await subGit.fetch('origin', targetBranch);
		await subGit.checkout(targetBranch);
		await subGit.reset(['--hard', `origin/${targetBranch}`]);
	}

	logger.success(`Reattached ${detached.length} submodule(s) to their configured branches.`);
	return true;
};

const pull = async () => {
	try {
		if (SERVER_ID !== 'development') {
			if (EXTENDED_LOGS) logger.info('Resetting local repository to HEAD (--hard)...');
			await git.reset(['--hard']);
		}

		logger.info('Pulling the repository and the required submodule...');

		const submoduleBefore = await git.raw(['submodule', 'status']);

		const pullOutput = await git.raw(['pull', 'origin', 'main']);
		await git.raw(['submodule', 'update', '--init', '--recursive', '--remote']);

		const submoduleAfter = await git.raw(['submodule', 'status']);
		const submoduleFixed = await ensureSubmodulesOnMain(submoduleAfter);
		const submoduleChanged = submoduleBefore !== submoduleAfter;
		const repoChanged = !pullOutput.includes('Already up to date');
		const hasChanges = repoChanged || submoduleChanged || submoduleFixed;

		if (hasChanges) {
			const parts = [];
			if (repoChanged) parts.push('Main repo updated.');
			if (submoduleChanged) parts.push('Submodules updated.');
			if (submoduleFixed) parts.push('Detached submodules reattached to main.');
			logger.info(`Updates pulled successfully! ${parts.join(' ')}`, { discord: true });
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
			logger.success(`Version changed: ${oldVersion} → ${newVersion}`, { discord: true });
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
