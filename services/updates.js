const fs = require('node:fs');
const path = require('node:path');
const simpleGit = require('simple-git');
const semver = require('semver');
const { CronJob } = require('cron');
const restartApp = require('./reloadApp.js');
const logger = require('../logger.js');
const { SERVER_ID, AUTO_UPDATE_SCHEDULE, EXTENDED_LOGS } = require('../../config.js').MAIN;

const repoRoot = path.resolve(__dirname, '../../');
const pkgPath = path.resolve(repoRoot, 'package.json');
const git = simpleGit(repoRoot);

// Parse .gitmodules to know submodule paths + their desired branches
const parseGitModules = () => {
	try {
		const file = path.join(repoRoot, '.gitmodules');
		if (!fs.existsSync(file)) return [];

		const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
		const list = [];
		let current = null;

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line) continue;

			const sectionMatch = line.match(/^\[submodule "(.*)"\\]$/);
			if (sectionMatch) {
				if (current?.path) list.push({ ...current });
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

		if (current?.path) list.push(current);
		return list;
	} catch {
		return [];
	}
};

// Capture declared submodules (path + branch) once at module init
const SUBMODULES = parseGitModules();

const getLocalVersion = () => {
	delete require.cache[require.resolve(pkgPath)];
	return require(pkgPath).version;
};

// Mirror .gitmodules branch definitions into .git/config
const configureSubmoduleBranches = async () => {
	if (!SUBMODULES.length) return;

	for (const submodule of SUBMODULES) {
		await git.raw(['config', `submodule.${submodule.name}.branch`, submodule.branch]);
	}
};

// Ensure each submodule checkout matches the target branch + remote tip
const syncSubmoduleWorktrees = async () => {
	if (!SUBMODULES.length) return false;

	let reattached = false;
	for (const submodule of SUBMODULES) {
		const submodulePath = path.join(repoRoot, submodule.path);
		if (!fs.existsSync(submodulePath)) continue;

		const subGit = simpleGit(submodulePath);
		await subGit.fetch('origin', submodule.branch);

		const currentRef = (await subGit.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
		if (currentRef !== submodule.branch) {
			logger.warn(`Submodule "${submodule.path}" is on "${currentRef}". Switching to "${submodule.branch}"...`);
			await subGit.checkout(submodule.branch);
			reattached = true;
		}

		await subGit.reset(['--hard', `origin/${submodule.branch}`]);
	}

	return reattached;
};

const pull = async () => {
	try {
		if (SERVER_ID !== 'development') {
			if (EXTENDED_LOGS) logger.info('Resetting local repository to HEAD (--hard)...');
			await git.reset(['--hard']);
		}

		// 1) pull repo + sync/reattach submodules
		logger.info('Updating repository (git pull origin main)...');

		const beforeCommit = (await git.revparse(['HEAD'])).trim();
		const submoduleStatusBefore = await git.raw(['submodule', 'status', '--recursive']);

		await git.pull('origin', 'main');

		await configureSubmoduleBranches();
		await git.raw(['submodule', 'sync', '--recursive']);
		await git.raw(['submodule', 'update', '--init', '--recursive', '--remote']);

		const submoduleStatusAfter = await git.raw(['submodule', 'status', '--recursive']);
		const submoduleDetachedFixed = await syncSubmoduleWorktrees();

		const submoduleChanged = submoduleStatusBefore !== submoduleStatusAfter;
		const afterCommit = (await git.revparse(['HEAD'])).trim();
		// Summarize main repo changes similar to git pull output
		const repoSummary = afterCommit !== beforeCommit
			? await git.diffSummary([beforeCommit, afterCommit])
			: { files: 0, insertions: 0, deletions: 0 };
		const repoChanged = repoSummary.files > 0;
		const hasChanges = repoChanged || submoduleChanged || submoduleDetachedFixed;

		if (hasChanges) {
			// Compose human-friendly summary for logs / Discord
			const parts = [];
			if (repoChanged) parts.push(`repo: ${repoSummary.files} files (+${repoSummary.insertions}/-${repoSummary.deletions})`);
			if (submoduleChanged) parts.push('submodules: references updated');
			if (submoduleDetachedFixed) parts.push('submodules: reattached to tracked branches');
			logger.info(`Updates applied (${parts.join(', ')})`, { discord: true });
		} else {
			logger.success('No updates detected (repo and submodules already up to date)');
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

// Schedule periodic update + run once at startup
new CronJob(AUTO_UPDATE_SCHEDULE, pullAndRestart, null, true);
(async () => pullAndRestart())();
