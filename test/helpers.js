const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const SCRIPTS_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.resolve(SCRIPTS_DIR, '..', 'config.js');

const DEFAULT_CONFIG = {
	SERVER_ID: 'test',
	EXTENDED_LOGS: false,
	IP_ASSIGNMENT: 'static',
	IPv6_SUPPORT: false,
	CACHE_FILE: path.join(os.tmpdir(), 'ipdb-scripts-test-cache.txt'),
	IP_REPORT_COOLDOWN: 60 * 60 * 1000,
	DISCORD_WEBHOOK_ENABLED: false,
	DISCORD_WEBHOOK_URL: '',
};

const stubModule = (filename, exports) => {
	const mod = new Module(filename);
	mod.filename = filename;
	mod.loaded = true;
	mod.exports = exports;
	require.cache[filename] = mod;
};

// Collects messages instead of printing them. Never sends webhooks.
const createLogger = () => {
	const messages = { info: [], success: [], warn: [], error: [], log: [], webhook: [] };
	const record = level => msg => messages[level].push(String(msg));

	return {
		messages,
		info: record('info'),
		success: record('success'),
		warn: record('warn'),
		error: record('error'),
		log: record('log'),
		webhook: async msg => messages.webhook.push(String(msg)),
	};
};

/**
 * Replaces the parent project's config.js and scripts/logger.js before any tested module is required.
 * Must be called at the top of every test file, because modules read the config at import time.
 * Each test file runs in a separate process, so the stubs do not leak between files.
 */
const setup = (main = {}, extra = {}) => {
	if (!fs.existsSync(CONFIG_PATH)) throw new Error(`Tests must be run inside an integration project with config.js present (${CONFIG_PATH})`);

	const logger = createLogger();
	stubModule(CONFIG_PATH, { MAIN: { ...DEFAULT_CONFIG, ...main }, ...extra });
	stubModule(path.join(SCRIPTS_DIR, 'logger.js'), logger);

	return { logger };
};

const scriptsPath = relative => path.join(SCRIPTS_DIR, relative);

const createTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipdb-scripts-'));

module.exports = { setup, stubModule, scriptsPath, createTempDir };
