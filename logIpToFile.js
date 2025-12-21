const fs = require('node:fs/promises');
const path = require('node:path');
const logger = require('../scripts/logger.js');
const resolvePath = require('./pathResolver.js');
const { LOG_IP_HISTORY_ENABLED, LOG_IP_HISTORY_DIR } = require('../config.js').MAIN;

const BASE_DIR = resolvePath(LOG_IP_HISTORY_DIR);

module.exports = async (ip, metadata = {}) => {
	if (!LOG_IP_HISTORY_ENABLED || !ip) return;

	const { honeypot = 'unknown', comment } = metadata;
	const logEntry = `[${new Date().toISOString()}] ${comment}\n`;

	const ipDir = path.join(BASE_DIR, ip);
	const logFile = path.join(ipDir, `${honeypot.toUpperCase()}.txt`);

	try {
		await fs.mkdir(ipDir, { recursive: true });
		await fs.appendFile(logFile, logEntry);
	} catch (err) {
		logger.error(`Failed to write IP log for ${ip}: ${err.message}`);
	}
};
