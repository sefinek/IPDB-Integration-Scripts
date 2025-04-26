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

module.exports = async () => {
	try {
		// 1
		log('Running npm install --omit=dev...', 0, true);
		const installResult = await executeCmd('npm install --omit=dev');
		log(installResult, 0, true);

		// 2
		const process = ecosystem.apps[0].name;
		log(`Running pm2 restart ${process}`, 0, true);

		const restartResult = await executeCmd(`pm2 restart ${process}`);
		log(restartResult, 0, true);
	} catch (err) {
		log(err, 3);
	}
};