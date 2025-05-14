const { dirname } = require('node:path');
const fs = require('node:fs/promises');
const { CACHE_FILE, IP_REPORT_COOLDOWN } = require('../../config.js').MAIN;
const logger = require('../logger.js');

const reportedIPs = new Map();

const ensureCacheDir = async () => {
	const dir = dirname(CACHE_FILE);

	try {
		await fs.access(dir);
	} catch (err) {
		if (err.code === 'ENOENT') {
			await fs.mkdir(dir, { recursive: true });
			logger.log(`Created cache directory: ${dir}`, 1);
		} else {
			logger.log(`Failed to access cache directory: ${err.stack}`, 3);
		}
	}
};

const loadReportedIPs = async () => {
	if (!CACHE_FILE) return;

	await ensureCacheDir();

	try {
		const fileContent = await fs.readFile(CACHE_FILE, 'utf8');
		fileContent
			.split('\n')
			.filter(Boolean)
			.forEach(line => {
				const [ip, time] = line.trim().split(/\s+/);
				if (ip && !isNaN(time)) reportedIPs.set(ip, Number(time));
			});
	} catch (err) {
		if (err.code === 'ENOENT') {
			logger.log(`${CACHE_FILE} does not exist. No data to load.`);
		} else {
			logger.log(`Failed to load cache file: ${err.stack}`, 3);
		}
	}
};

const saveReportedIPs = async () => {
	if (!CACHE_FILE) return;
	await ensureCacheDir();

	try {
		const data = Array.from(reportedIPs)
			.map(([ip, time]) => `${ip} ${time}`)
			.join('\n');
		await fs.writeFile(CACHE_FILE, data, 'utf8');
	} catch (err) {
		logger.log(`Failed to save cache file: ${err.stack}`, 3);
	}
};

const isIPReportedRecently = ip => {
	const reportedTime = reportedIPs.get(ip);
	return reportedTime && (Date.now() / 1000 - reportedTime < IP_REPORT_COOLDOWN / 1000);
};

const markIPAsReported = ip => reportedIPs.set(ip, Math.floor(Date.now() / 1000));

module.exports = {
	reportedIPs,
	loadReportedIPs,
	saveReportedIPs,
	isIPReportedRecently,
	markIPAsReported,
};