const { exec } = require('node:child_process');
const ecosystem = require('../../ecosystem.config.js');
const logger = require('../logger.js');

const EXEC_TIMEOUT = 60000;

const executeCmd = cmd => new Promise((resolve, reject) => {
	exec(cmd, { timeout: EXEC_TIMEOUT }, (err, stdout, stderr) => {
		if (err) {
			logger.log(`Error executing command: ${cmd}\n${err}`, 3);
			return reject(err);
		}
		if (stderr) logger.log(`Warning while executing: ${cmd}\n${stderr}`, 2);

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
		logger.log(`Running npm '${CMD_1}'...`);
		const result1 = await executeCmd(CMD_1);
		logger.log(result1, 0, true);

		// 2 - restart
		logger.log(`Running '${CMD_2}'...`);
		const result2 = await executeCmd(CMD_2);
		logger.log(result2, 0, true);
	} catch (err) {
		logger.log(err.stack, 3);
	}
};