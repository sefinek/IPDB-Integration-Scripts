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
const CMD_2 = (() => {
	if (!ecosystem.apps?.[0]?.name) throw new Error('Missing app name in ecosystem config');
	return `pm2 restart ${ecosystem.apps[0].name}`;
})();

module.exports = async () => {
	try {
		// 1 - npm dependencies
		logger.info(`Running npm '${CMD_1}'...`);
		const result1 = await executeCmd(CMD_1);
		logger.info(result1, { discord: true });

		// 2 - restart
		logger.info(`Running '${CMD_2}'...`);
		const result2 = await executeCmd(CMD_2);
		logger.info(result2, { discord: true });
	} catch (err) {
		logger.error(err.stack);
	}
};
