const { exec } = require('node:child_process');
const ecosystem = require('../../ecosystem.config.js');
const log = require('../utils/log.js');

const executeCmd = cmd =>
	new Promise((resolve, reject) => {
		exec(cmd, (err, stdout, stderr) => {
			if (err || stderr) {
				log(`Error executing command: ${cmd}\n${stderr || err}`, 3);
				reject(err || stderr);
			} else {
				resolve(stdout);
			}
		});
	});

const CMD_1 = 'npm install --omit=dev';
const CMD_2 = `pm2 restart ${ecosystem.apps[0].name}`;

module.exports = async () => {
	try {
		// 1 - npm dependencies
		log(`Running npm '${CMD_1}'...`);
		const result1 = await executeCmd(CMD_1);
		log(result1, 0, true);

		// 2 - restart
		log(`Running '${CMD_2}'...`);

		const result2 = await executeCmd(CMD_2);
		log(result2, 0, true);
	} catch (err) {
		log(err, 3);
	}
};