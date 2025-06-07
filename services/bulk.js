'use strict';

const FormData = require('form-data');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fs = require('node:fs/promises');
const path = require('node:path');
const { bulk } = require('../services/axios.js');
const { ABUSEIPDB } = require('../headers.js');
const { saveReportedIPs, markIPAsReported } = require('../services/cache.js');
const logger = require('../logger.js');

const BULK_REPORT_BUFFER = new Map();
const BUFFER_FILE = path.join(__dirname, '..', '..', 'tmp', 'bulk-report-buffer.csv');
const ABUSE_STATE = { isLimited: false, isBuffering: false, sentBulk: false };

const ensureDirectoryExists = async filePath => {
	try {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
	} catch (err) {
		if (err.code !== 'EEXIST') throw err;
	}
};

const saveBufferToFile = async () => {
	if (!BULK_REPORT_BUFFER.size) return;

	const records = [];
	for (const [ip, entry] of BULK_REPORT_BUFFER.entries()) {
		records.push([ip, entry.categories, new Date(entry.timestamp).toISOString(), entry.comment]);
	}

	try {
		const output = stringify(records, { header: true, columns: ['IP', 'Categories', 'ReportDate', 'Comment'], quoted: true });
		await ensureDirectoryExists(BUFFER_FILE);
		await fs.writeFile(BUFFER_FILE, output);
	} catch (err) {
		logger.log(`❗ Failed to write buffer file: ${err.message}`, 3, true);
	}
};

const loadBufferFromFile = async () => {
	try {
		await fs.access(BUFFER_FILE);

		const fileContent = await fs.readFile(BUFFER_FILE, 'utf-8');
		const records = parse(fileContent, { columns: false, from_line: 2, skip_empty_lines: true, trim: true });

		for (const record of records) {
			const [ip, categories, timestamp, comment] = record;
			if (!ip || !timestamp) continue;
			BULK_REPORT_BUFFER.set(ip, { categories, timestamp: new Date(timestamp).getTime(), comment });
		}
	} catch (err) {
		if (err.code !== 'ENOENT') logger.log(`Failed to parse/load buffer file: ${err.message}`, 3, true);
	}
};

const sendBulkReport = async () => {
	if (!BULK_REPORT_BUFFER.size) return;

	const records = [];
	for (const [ip, entry] of BULK_REPORT_BUFFER.entries()) {
		records.push([
			ip,
			entry.categories,
			new Date(entry.timestamp ?? Date.now()).toISOString(),
			entry.comment,
		]);
	}

	try {
		const payload = stringify(records, {
			header: true,
			columns: ['IP', 'Categories', 'ReportDate', 'Comment'],
			quoted: true,
		});

		const form = new FormData();
		form.append('csv', Buffer.from(payload), {
			filename: 'report.csv',
			contentType: 'text/csv',
		});

		const { data } = await bulk.post('/bulk-report', form, {
			headers: {
				...ABUSEIPDB.headers,
				...form.getHeaders(),
			},
		});

		const saved = data?.data?.savedReports ?? 0;
		const failed = data?.data?.invalidReports?.length ?? 0;

		logger.log(`Sent bulk report (${BULK_REPORT_BUFFER.size} IPs): ${saved} accepted, ${failed} rejected`, 1);

		if (failed > 0) {
			data.data.invalidReports.forEach(fail => {
				logger.log(`Rejected in bulk report [Row ${fail.rowNumber}] ${fail.input} -> ${fail.error}`, 2);
			});
		}

		for (const ip of BULK_REPORT_BUFFER.keys()) markIPAsReported(ip);
		await saveReportedIPs();
		BULK_REPORT_BUFFER.clear();

		await fs.unlink(BUFFER_FILE);
		ABUSE_STATE.sentBulk = true;
	} catch (err) {
		logger.log(err.stack, 3, true);
	}
};

module.exports = Object.freeze({
	saveBufferToFile,
	loadBufferFromFile,
	sendBulkReport,
	BULK_REPORT_BUFFER,
});