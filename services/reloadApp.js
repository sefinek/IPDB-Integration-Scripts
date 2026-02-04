const { exec } = require('node:child_process');
const ecosystem = require('../../ecosystem.config.js');
const logger = require('../logger.js');

const EXEC_TIMEOUT = 60000;
const RELOAD_RETRY_DELAY = 35000;
const RELOAD_MAX_RETRIES = 3;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const executeCmd = cmd => new Promise((resolve, reject) => {
	exec(cmd, { timeout: EXEC_TIMEOUT }, (err, stdout, stderr) => {
		if (err) return reject(err);
		if (stderr) logger.warn(`Warning while executing: ${cmd}\n${stderr}`);

		resolve(stdout.trim());
	});
});

const executeCmdWithRetry = async cmd => {
	for (let attempt = 1; attempt <= RELOAD_MAX_RETRIES; attempt++) {
		try {
			return await executeCmd(cmd);
		} catch (err) {
			const isReloadInProgress = err.message?.includes('Reload already in progress');
			const hasRetriesLeft = attempt < RELOAD_MAX_RETRIES;

			if (isReloadInProgress && hasRetriesLeft) {
				logger.info(`Reload already in progress. Waiting ${RELOAD_RETRY_DELAY / 1000}s before attempt ${attempt + 1}/${RELOAD_MAX_RETRIES}...`, { discord: true });
				await sleep(RELOAD_RETRY_DELAY);
			} else {
				logger.error(`Error executing command: ${cmd}\n${err}`, { ping: true });
				throw err;
			}
		}
	}
};

const CMD_1 = 'npm install --omit=dev';
const APP_NAME = (() => {
	if (!ecosystem.apps?.[0]?.name) throw new Error('Missing app name in ecosystem config');
	return ecosystem.apps[0].name;
})();
const CMD_2 = `pm2 reload ${APP_NAME}`;

module.exports = async () => {
	try {
		// 1 - npm dependencies
		logger.info(`Running npm '${CMD_1}'...`);
		const result1 = await executeCmd(CMD_1);
		logger.info(result1, { discord: true });

		// 2 - reload
		if (process.env.pm_id !== undefined) {
			logger.info(`Running '${CMD_2}'...`);
			const result2 = await executeCmdWithRetry(CMD_2);
			logger.info(result2, { discord: true });
		} else {
			logger.info('Process is not managed by PM2! Exiting to apply updates. To start again, run: node . (one-time), pm2 start (24/7 with auto-restart).', { discord: true });
			process.exit(0);
		}
	} catch (err) {
		logger.error(err.stack);
	}
};
