const fs = require('fs');
const path = require('path');
const logger = require('../scripts/logger.js');
const { IP_LOG_DIR } = require('../config.js').MAIN;

const BASE_DIR = path.resolve(IP_LOG_DIR);

module.exports = (ip, metadata = {}) => {
	if (!ip) return;

	const { honeypot = 'unknown', proto, dpt, category, comment } = metadata;
	const timestamp = new Date().toISOString();

	const logEntry =
        `[${timestamp}] ${proto ? `[${proto.toUpperCase()}]` : ''}${dpt ? `:${dpt}` : ''}${category ? ` [cat ${category}]` : ''}\n${comment}\n\n`;

	const ipDir = path.join(BASE_DIR, ip);
	if (!fs.existsSync(ipDir)) {
		fs.mkdirSync(ipDir, { recursive: true });
	}

	const logFile = path.join(ipDir, `${honeypot.toUpperCase()}.txt`);
	fs.appendFile(logFile, logEntry, err => {
		if (err) logger.log(`✘ Failed to write IP log for ${ip}: ${err.message}`, 3, true);
	});
};