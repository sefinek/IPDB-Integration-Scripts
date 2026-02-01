const { dirname } = require('node:path');
const fs = require('node:fs/promises');
const resolvePath = require('../pathResolver.js');
const { CACHE_FILE, IP_REPORT_COOLDOWN } = require('../../config.js').MAIN;
const { queueWrite, atomicWriteFile } = require('./writeQueue.js');
const logger = require('../logger.js');

const reportedIPs = new Map();
const RESOLVED_CACHE_FILE = resolvePath(CACHE_FILE);

const ensureCacheDir = async () => {
	const dir = dirname(RESOLVED_CACHE_FILE);

	try {
		await fs.access(dir);
	} catch (err) {
		if (err.code === 'ENOENT') {
			await fs.mkdir(dir, { recursive: true });
			logger.success(`Created cache directory: ${dir}`);
		} else {
			logger.error(`Failed to access cache directory: ${err.stack}`);
		}
	}
};

const loadReportedIPs = async () => {
	if (!RESOLVED_CACHE_FILE) return;

	await ensureCacheDir();

	try {
		const fileContent = await fs.readFile(RESOLVED_CACHE_FILE, 'utf8');
		fileContent
			.split('\n')
			.filter(Boolean)
			.forEach(line => {
				const [ip, time] = line.trim().split(/\s+/);
				if (ip && !isNaN(time)) reportedIPs.set(ip, Number(time));
			});
	} catch (err) {
		if (err.code === 'ENOENT') {
			logger.info(`${RESOLVED_CACHE_FILE} does not exist. No data to load.`);
		} else {
			logger.error(`Failed to load cache file: ${err.stack}`);
		}
	}
};

const saveReportedIPs = () => {
	if (!RESOLVED_CACHE_FILE) return Promise.resolve();
	return queueWrite(RESOLVED_CACHE_FILE, async () => {
		await ensureCacheDir();
		try {
			const data = Array.from(reportedIPs)
				.map(([ip, time]) => `${ip} ${time}`)
				.join('\n');
			await atomicWriteFile(RESOLVED_CACHE_FILE, data);
		} catch (err) {
			logger.error(`Failed to save cache file: ${err.stack}`);
		}
	});
};

const IP_REPORT_COOLDOWN_SECONDS = IP_REPORT_COOLDOWN / 1000;

const isIPReportedRecently = ip => {
	const reportedTime = reportedIPs.get(ip);
	if (!reportedTime) return false;
	return (Math.floor(Date.now() / 1000) - reportedTime < IP_REPORT_COOLDOWN_SECONDS);
};

const markIPAsReported = ip => reportedIPs.set(ip, Math.floor(Date.now() / 1000));

module.exports = Object.freeze({
	reportedIPs,
	loadReportedIPs,
	saveReportedIPs,
	isIPReportedRecently,
	markIPAsReported,
});
