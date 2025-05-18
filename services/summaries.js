const { CronJob } = require('cron');
const fs = require('node:fs/promises');
const logger = require('../logger.js');
const { SERVER_ID, EXTENDED_LOGS, CACHE_FILE } = require('../../config.js').MAIN;

const pad = n => n.toString().padStart(2, '0');
const formatHourRange = h => `${pad(h)}:00-${pad(h)}:59`;
const pluralizeReport = n => (n === 1 ? 'report' : 'reports');

const summaryEmbed = async () => {
	const now = new Date();
	const midnightLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(midnightLocal.getTime() - 86400000);
	const yesterdayString = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
	const baseTs = Math.floor(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()) / 1000);

	if (EXTENDED_LOGS) {
		logger.log(`Daily summary » Using base timestamp: ${baseTs} (${new Date(baseTs * 1000).toISOString()}) for ${yesterdayString}`);
	}

	let data;
	if (SERVER_ID === 'development') {
		logger.log('Daily summary » Using test data instead of reading cache file [DEV]');
		data = [
			`1.1.1.1 ${baseTs}`,
			`8.8.8.8 ${baseTs + 3600}`,
			`1.0.0.1 ${baseTs}`,
		].join('\n');
	} else {
		try {
			await fs.access(CACHE_FILE);
			data = (await fs.readFile(CACHE_FILE, 'utf8')).trim();
			if (!data) return logger.log(`Daily summary » Cache file exists but is empty: ${CACHE_FILE}`, 2);
		} catch (err) {
			return logger.log(`Daily summary » Failed to access/read cache file: ${err.message}`, 2);
		}
	}

	try {
		const hourlySummary = {};
		const seen = new Set();

		for (const line of data.split('\n')) {
			const [ip, tsStr] = line.split(' ');
			const ts = parseInt(tsStr, 10);
			if (!ip || isNaN(ts)) continue;

			const key = `${ip}_${ts}`;
			if (seen.has(key)) continue;
			seen.add(key);

			const date = new Date(ts * 1000);
			const dateStr = date.toISOString().split('T')[0];
			if (dateStr !== yesterdayString) continue;

			const hour = date.getUTCHours();
			hourlySummary[hour] = (hourlySummary[hour] || 0) + 1;
		}

		if (!Object.keys(hourlySummary).length) {
			return logger.log(`Daily summary » No reports found for ${yesterdayString}`, 2);
		}

		const sorted = Object.entries(hourlySummary)
			.map(([h, c]) => [parseInt(h), c])
			.sort((a, b) => b[1] - a[1]);

		const total = sorted.reduce((sum, [, c]) => sum + c, 0);
		const top3 = sorted.slice(0, 3).map(([h]) => h);

		const summaryStr = sorted
			.map(([h, c]) => `${formatHourRange(h)} → ${c} ${pluralizeReport(c)}${top3.includes(h) ? ' 🔥' : ''}`)
			.join('\n');
		logger.log(`Midnight. Summary of IP address reports (${total}) from ${yesterdayString}:\n${summaryStr}`);

		const peakStr = sorted.slice(0, 3)
			.map(([h, c]) => `${formatHourRange(h)} → ${c} ${pluralizeReport(c)}`)
			.join('\n');
		logger.log(`Top 3 peaks:\n${peakStr}`);

		await logger.webhook(
			`Midnight. Summary of IP address reports from yesterday.\nGood night to you, sleep well! 😴\n### ${total} ${pluralizeReport(total)} from ${yesterdayString}\n\`\`\`${summaryStr}\`\`\`\n### Top 3 peaks\n\`\`\`${peakStr}\`\`\``,
			0x00FF39
		);
	} catch (err) {
		logger.log(`Daily summary » Unexpected error:\n${err.stack}`, 3);
	}
};

module.exports = async () => {
	await summaryEmbed();
	new CronJob('0 0 * * *', summaryEmbed, null, true);
};