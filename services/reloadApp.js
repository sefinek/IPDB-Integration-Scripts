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
		// 1 - npm dependencies
		log('Running npm install --omit=dev...', 0, true);
		const result1 = await executeCmd('npm install --omit=dev');
		log(result1, 0, true);

		// 2 - restart
		const process = ecosystem.apps[0].name;
		log(`Running pm2 restart ${process}...`, 0, true);

		const result2 = await executeCmd(`pm2 restart ${process}`);
		log(result2, 0, true);
	} catch (err) {
		log(err, 3);
	}
};