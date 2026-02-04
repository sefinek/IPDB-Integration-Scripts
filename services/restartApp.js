const { exec } = require('node:child_process');
const ecosystem = require('../../ecosystem.config.js');
const logger = require('../logger.js');

const EXEC_TIMEOUT = 60000;

const executeCmd = cmd => new Promise((resolve, reject) => {
	exec(cmd, { timeout: EXEC_TIMEOUT }, (err, stdout, stderr) => {
		if (err) return reject(err);
		if (stderr) logger.warn(`Warning while executing: ${cmd}\n${stderr}`);

		resolve(stdout.trim());
	});
});

const CMD_1 = 'npm install --omit=dev';
const APP_NAME = (() => {
	if (!ecosystem.apps?.[0]?.name) throw new Error('Missing app name in ecosystem config');
	return ecosystem.apps[0].name;
})();
const CMD_2 = `pm2 restart ${APP_NAME}`;

module.exports = async () => {
	try {
		// 1 - npm dependencies
		logger.info(`Running npm '${CMD_1}'...`);
		const result1 = await executeCmd(CMD_1);
		logger.info(result1, { discord: true });

		// 2 - restart
		if (process.env.pm_id !== undefined) {
			logger.info(`Running '${CMD_2}'...`);
			await executeCmd(CMD_2);
		} else {
			logger.info('Process is not managed by PM2! Exiting to apply updates. To start again, run: node . (one-time), pm2 start (24/7 with auto-restart).', { discord: true });
			process.exit(0);
		}
	} catch (err) {
		logger.error(err.stack);
	}
};
