const FormData = require('form-data');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('../services/axios.js');
const { saveReportedIPs, markIPAsReported } = require('../services/cache.js');
const log = require('../log.js');
const { ABUSEIPDB_API_KEY } = require('../../config.js').MAIN;

const BULK_REPORT_BUFFER = new Map();
const BUFFER_FILE = path.join(__dirname, '..', '..', 'tmp', 'bulk-report-buffer.csv');
const ABUSE_STATE = { isLimited: false, isBuffering: false, sentBulk: false };

const ensureDirectoryExists = filePath => {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const saveBufferToFile = () => {
	if (!BULK_REPORT_BUFFER.size) return;

	const records = [];
	for (const [ip, entry] of BULK_REPORT_BUFFER.entries()) {
		records.push([ip, entry.categories, new Date(entry.timestamp).toISOString(), entry.comment]);
	}

	try {
		const output = stringify(records, { header: true, columns: ['IP', 'Categories', 'ReportDate', 'Comment'], quoted: true });
		ensureDirectoryExists(BUFFER_FILE);
		fs.writeFileSync(BUFFER_FILE, output);
	} catch (err) {
		log(`Failed to write buffer file: ${err.message}`, 3);
	}
};

const loadBufferFromFile = () => {
	if (!fs.existsSync(BUFFER_FILE)) return;

	try {
		const fileContent = fs.readFileSync(BUFFER_FILE, 'utf-8');
		const records = parse(fileContent, { columns: false, from_line: 2, skip_empty_lines: true, trim: true });

		for (const record of records) {
			const [ip, categories, timestamp, comment] = record;
			if (!ip || !timestamp) continue;
			BULK_REPORT_BUFFER.set(ip, { categories, timestamp: new Date(timestamp).getTime(), comment });
		}
	} catch (err) {
		log(`Failed to parse buffer file: ${err.message}`, 3);
	} finally {
		if (fs.existsSync(BUFFER_FILE)) fs.unlinkSync(BUFFER_FILE);
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

		const { data } = await axios.post('/bulk-report', form, {
			headers: {
				Key: ABUSEIPDB_API_KEY,
				...form.getHeaders(),
			},
		});

		const saved = data?.data?.savedReports ?? 0;
		const failed = data?.data?.invalidReports?.length ?? 0;

		log(`Sent bulk report (${BULK_REPORT_BUFFER.size} IPs): ${saved} accepted, ${failed} rejected`, 1);

		if (failed > 0) {
			data.data.invalidReports.forEach(fail => {
				log(`Rejected in bulk report [Row ${fail.rowNumber}] ${fail.input} -> ${fail.error}`, 2);
			});
		}

		for (const ip of BULK_REPORT_BUFFER.keys()) markIPAsReported(ip);
		saveReportedIPs();
		BULK_REPORT_BUFFER.clear();
		if (fs.existsSync(BUFFER_FILE)) fs.unlinkSync(BUFFER_FILE);
		ABUSE_STATE.sentBulk = true;
	} catch (err) {
		log(`Failed to send bulk report to AbuseIPDB: ${err.stack}`, 3);
	}
};

module.exports = {
	saveBufferToFile,
	loadBufferFromFile,
	sendBulkReport,
	BULK_REPORT_BUFFER,
};
