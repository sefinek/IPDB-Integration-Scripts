const fs = require('fs');
const path = require('path');
const logger = require('../scripts/logger.js');
const { LOG_IP_HISTORY_ENABLED, LOG_IP_HISTORY_DIR } = require('../config.js').MAIN;

const BASE_DIR = path.resolve(LOG_IP_HISTORY_DIR);

module.exports = (ip, metadata = {}) => {
	if (!LOG_IP_HISTORY_ENABLED || !ip) return;

	const { honeypot = 'unknown', comment } = metadata;
	const logEntry = `[${new Date().toISOString()}] ${comment}\n`;

	const ipDir = path.join(BASE_DIR, ip);
	if (!fs.existsSync(ipDir)) fs.mkdirSync(ipDir, { recursive: true });

	const logFile = path.join(ipDir, `${honeypot.toUpperCase()}.txt`);
	fs.appendFile(logFile, logEntry, err => {
		if (err) logger.log(`Failed to write IP log for ${ip}: ${err.message}`, 3, true);
	});
};