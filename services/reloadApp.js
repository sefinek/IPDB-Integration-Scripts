const { exec } = require('node:child_process');
const ecosystem = require('../../ecosystem.config.js');
const logger = require('../logger.js');

const EXEC_TIMEOUT = 60000;

const executeCmd = cmd => new Promise((resolve, reject) => {
	exec(cmd, { timeout: EXEC_TIMEOUT }, (err, stdout, stderr) => {
		if (err) {
			logger.error(`Error executing command: ${cmd}\n${err}`, { ping: true });
			return reject(err);
		}
		if (stderr) logger.warn(`Warning while executing: ${cmd}\n${stderr}`);

		resolve(stdout.trim());
	});
});

const CMD_1 = 'npm install --omit=dev';
const APP_NAME = (() => {
	if (!ecosystem.apps?.[0]?.name) throw new Error('Missing app name in ecosystem config');
	return ecosystem.apps[0].name;
})();
const CMD_2 = `pm2 reload ${APP_NAME} --update-env`;

module.exports = async () => {
	try {
		// 1 - npm dependencies
		logger.info(`Running npm '${CMD_1}'...`);
		const result1 = await executeCmd(CMD_1);
		logger.info(result1, { discord: true });

		// 2 - reload
		if (process.env.pm_id !== undefined) {
			process.env.SKIP_INITIAL_PULL = '1';
			logger.info(`Running '${CMD_2}'...`);
			const result2 = await executeCmd(CMD_2);
			logger.info(result2, { discord: true });
		} else {
			logger.info('Process is not managed by PM2. The application will now exit. Please start it again manually to apply the updates.', { discord: true });
			process.exit(0);
		}
	} catch (err) {
		logger.error(err.stack);
	}
};
