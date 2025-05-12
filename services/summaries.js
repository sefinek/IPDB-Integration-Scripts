const { CronJob } = require('cron');
const fs = require('node:fs/promises');
const logger = require('../logger.js');
const { CACHE_FILE } = require('../../config.js').MAIN;

const formatHourRange = hour => `${hour.toString().padStart(2, '0')}:00-${hour.toString().padStart(2, '0')}:59`;
const pluralizeReport = count => (count === 1 ? 'report' : 'reports');

const summaryEmbed = async () => {
	try {
		await fs.access(CACHE_FILE);
	} catch {
		return logger.log(`Cache file not found: ${CACHE_FILE}`, 3);
	}

	let data;
	try {
		data = (await fs.readFile(CACHE_FILE, 'utf8')).trim();
	} catch (err) {
		return logger.log(`Error reading file: ${err.message}`, 3);
	}

	if (!data) logger.log(`Cache file is empty: ${CACHE_FILE}`);

	try {
		const yesterday = new Date();
		yesterday.setUTCDate(yesterday.getUTCDate() - 1);
		const yesterdayString = yesterday.toISOString().split('T')[0];

		const hourlySummary = {};
		const uniqueEntries = new Set();

		data.split('\n').forEach((line) => {
			const [ip, timestamp] = line.split(' ');
			if (!ip || isNaN(timestamp)) return;

			const entryKey = `${ip}_${timestamp}`;
			if (uniqueEntries.has(entryKey)) return;
			uniqueEntries.add(entryKey);

			const dateObj = new Date(parseInt(timestamp, 10) * 1000);
			if (dateObj.toISOString().split('T')[0] !== yesterdayString) return;

			const hour = dateObj.getUTCHours();
			hourlySummary[hour] = (hourlySummary[hour] || 0) + 1;
		});

		const totalReports = Object.values(hourlySummary).reduce((sum, count) => sum + count);
		const sortedEntries = Object.entries(hourlySummary).sort((a, b) => b[1] - a[1]);
		const maxReports = sortedEntries.length > 0 ? sortedEntries[0][1] : 0;
		const topHours = sortedEntries
			.filter(([, count]) => count === maxReports && count > 1)
			.map(([hour]) => parseInt(hour));

		const summaryStr = Object.entries(hourlySummary)
			.map(([hour, count]) => `${formatHourRange(parseInt(hour))}: ${count} ${pluralizeReport(count)}${topHours.includes(parseInt(hour)) ? ' 🔥' : ''}`)
			.join('\n');

		await logger.webhook(
			`Midnight. Summary of IP address reports (${totalReports}) from yesterday (${yesterdayString}).\nGood night to you, sleep well! 😴\n\`\`\`${summaryStr}\`\`\``,
			0x00FF39);
		logger.log(`Midnight. Summary of IP address reports (${totalReports}) from yesterday (${yesterdayString}).\n${summaryStr}`, 1);
	} catch (err) {
		logger.log(err.stack, 3);
	}
};

module.exports = async () => {
	// await sendWebhook();
	new CronJob('0 0 * * *', summaryEmbed, null, true);
};