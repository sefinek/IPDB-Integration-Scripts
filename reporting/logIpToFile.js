const fs = require('node:fs/promises');
const path = require('node:path');
const ipSanitizer = require('../ip/ipSanitizer.js');
const logger = require('../core/logger.js');
const resolvePath = require('../core/pathResolver.js');
const { LOG_IP_HISTORY_ENABLED, LOG_IP_HISTORY_DIR } = require('../../config.js').MAIN;

const BASE_DIR = resolvePath(LOG_IP_HISTORY_DIR);

module.exports = async (ip, metadata = {}) => {
	if (!LOG_IP_HISTORY_ENABLED || !ip) return;

	const { honeypot = 'unknown', comment } = metadata;
	const logEntry = `[${new Date().toISOString()}] ${ipSanitizer(comment)}\n`;

	const ipDir = path.join(BASE_DIR, ip);
	const logFile = path.join(ipDir, `${honeypot.toUpperCase()}.txt`);

	try {
		await fs.mkdir(ipDir, { recursive: true });
		await fs.appendFile(logFile, logEntry);
	} catch (err) {
		logger.error(`Failed to write IP log for ${ip}: ${err.message}`);
	}
};
