const { dirname } = require('node:path');
const fs = require('node:fs/promises');
const normalizeIP = require('../normalizeIP.js');
const resolvePath = require('../pathResolver.js');
const { CACHE_FILE, IP_REPORT_COOLDOWN } = require('../../config.js').MAIN;
const { queueSnapshotWrite, atomicWriteFile } = require('./writeQueue.js');
const logger = require('../logger.js');

const reportedIPs = new Map();
const RESOLVED_CACHE_FILE = resolvePath(CACHE_FILE);
const IP_REPORT_COOLDOWN_SECONDS = IP_REPORT_COOLDOWN / 1000;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const isExpired = (time, now) => now - time >= IP_REPORT_COOLDOWN_SECONDS;

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
		const now = nowSeconds();

		for (const line of fileContent.split('\n')) {
			const [rawIp, rawTime] = line.trim().split(/\s+/);
			const ip = normalizeIP(rawIp);
			const time = Number(rawTime);
			if (!ip || !Number.isFinite(time) || time <= 0 || time > now || isExpired(time, now)) continue;

			reportedIPs.set(ip, Math.max(reportedIPs.get(ip) || 0, time));
		}
	} catch (err) {
		if (err.code === 'ENOENT') {
			logger.info(`${RESOLVED_CACHE_FILE} does not exist. No data to load.`);
		} else {
			logger.error(`Failed to load cache file: ${err.stack}`);
		}
	}
};

// Expired entries are dropped here, so neither the map nor the file grows without limit
const saveReportedIPs = () => {
	if (!RESOLVED_CACHE_FILE) return Promise.resolve();
	return queueSnapshotWrite(RESOLVED_CACHE_FILE, async () => {
		await ensureCacheDir();
		try {
			const now = nowSeconds();
			const lines = [];
			for (const [ip, time] of reportedIPs) {
				if (isExpired(time, now)) reportedIPs.delete(ip);
				else lines.push(`${ip} ${time}`);
			}

			await atomicWriteFile(RESOLVED_CACHE_FILE, lines.join('\n'));
		} catch (err) {
			logger.error(`Failed to save cache file: ${err.stack}`);
		}
	});
};

const isIPReportedRecently = ip => {
	const reportedTime = reportedIPs.get(normalizeIP(ip));
	if (!reportedTime) return false;
	return !isExpired(reportedTime, nowSeconds());
};

const markIPAsReported = ip => {
	const normalized = normalizeIP(ip);
	if (!normalized) return logger.warn(`Cannot mark invalid IP address as reported: ${ip}`);

	reportedIPs.set(normalized, nowSeconds());
};

module.exports = Object.freeze({
	reportedIPs,
	loadReportedIPs,
	saveReportedIPs,
	isIPReportedRecently,
	markIPAsReported,
});
