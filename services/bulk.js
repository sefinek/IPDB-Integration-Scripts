const FormData = require('form-data');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fs = require('node:fs/promises');
const path = require('node:path');
const { axiosBulk } = require('./axios.js');
const { saveReportedIPs, markIPAsReported } = require('./cache.js');
const ABUSE_STATE = require('./state.js');
const { queueSnapshotWrite, atomicWriteFile } = require('./writeQueue.js');
const { truncateComment } = require('../reporting/comment.js');
const uploadSnapshot = require('./bulkUpload.js');
const logger = require('../core/logger.js');

const BULK_REPORT_BUFFER = new Map();
const BUFFER_FILE = path.join(__dirname, '..', '..', 'tmp', 'bulk-report-buffer.csv');
const API_COLUMNS = ['IP', 'Categories', 'ReportDate', 'Comment'];

// The optional Context column stores event data that lets an integration re-evaluate the entry before upload. It is never sent to the API.
const BUFFER_COLUMNS = [...API_COLUMNS, 'Context'];

let currentUpload = null;

const saveBufferToFile = () => queueSnapshotWrite(BUFFER_FILE, async () => {
	try {
		if (!BULK_REPORT_BUFFER.size) {
			await fs.rm(BUFFER_FILE, { force: true });
			return;
		}

		const records = Array.from(BULK_REPORT_BUFFER, ([ip, entry]) => [
			ip,
			entry.categories,
			new Date(entry.timestamp).toISOString(),
			entry.comment,
			entry.context ? JSON.stringify(entry.context) : '',
		]);

		await fs.mkdir(path.dirname(BUFFER_FILE), { recursive: true });
		await atomicWriteFile(BUFFER_FILE, stringify(records, { header: true, columns: BUFFER_COLUMNS, quoted: true }));
	} catch (err) {
		logger.error(`Failed to write buffer file: ${err.message}`, { ping: true });
	}
});

const parseContext = (ip, value) => {
	if (!value) return undefined;

	try {
		return JSON.parse(value);
	} catch {
		logger.warn(`Invalid context of buffered IP ${ip}, ignoring it`);
		return undefined;
	}
};

const loadBufferFromFile = async () => {
	let content;
	try {
		content = await fs.readFile(BUFFER_FILE, 'utf8');
	} catch (err) {
		if (err.code !== 'ENOENT') logger.error(`Failed to read buffer file: ${err.message}`);
		return;
	}

	try {
		const records = parse(content, { columns: false, from_line: 2, skip_empty_lines: true, trim: true, relax_column_count: true });

		for (const [ip, categories, reportDate, comment, context] of records) {
			const timestamp = Date.parse(reportDate);
			if (!ip || !Number.isFinite(timestamp)) continue;

			BULK_REPORT_BUFFER.set(ip, { categories, timestamp, comment, context: parseContext(ip, context) });
		}
	} catch (err) {
		logger.error(`Failed to parse buffer file: ${err.message}`);
	}
};

const toPayload = chunk => {
	const records = chunk.map(([ip, entry]) => [
		ip,
		entry.categories,
		new Date(entry.timestamp).toISOString(),
		truncateComment(entry.comment || ''),
	]);

	return stringify(records, { header: true, columns: API_COLUMNS, quoted: true });
};

const upload = async chunk => {
	const form = new FormData();
	form.append('csv', Buffer.from(toPayload(chunk)), { filename: 'report.csv', contentType: 'text/csv' });

	const { data } = await axiosBulk.post('/bulk-report', form, { headers: form.getHeaders() });
	return data?.data;
};

const performUpload = async validateEntry => {
	const snapshot = [];
	for (const item of BULK_REPORT_BUFFER) {
		if (!validateEntry || validateEntry(...item)) {
			snapshot.push(item);
		} else {
			BULK_REPORT_BUFFER.delete(item[0]);
			logger.info(`Removed ${item[0]} from the bulk buffer, it is no longer eligible for reporting`);
		}
	}

	if (!snapshot.length) {
		await saveBufferToFile();
		return true;
	}

	logger.info(`Starting bulk report upload (${snapshot.length} IPs)...`);

	let accepted = 0, rejected = 0;
	const completed = await uploadSnapshot({
		snapshot,
		upload,
		logger,
		accept: async ([ip, entry]) => {
			accepted++;
			markIPAsReported(ip);
			if (BULK_REPORT_BUFFER.get(ip) === entry) BULK_REPORT_BUFFER.delete(ip);
		},
		reject: async ([ip, entry], reason) => {
			rejected++;
			logger.warn(`Bulk report rejected ${ip}: ${reason}`);
			if (BULK_REPORT_BUFFER.get(ip) === entry) BULK_REPORT_BUFFER.delete(ip);
		},
		settle: async () => {
			await saveReportedIPs();
			await saveBufferToFile();
		},
	});

	if (accepted || rejected) logger.success(`Sent bulk report: ${accepted} accepted, ${rejected} rejected`, { discord: true });
	if (!completed) logger.error(`Bulk upload incomplete, ${BULK_REPORT_BUFFER.size} IPs kept in the buffer for retry`, { ping: true });

	ABUSE_STATE.sentBulk = completed;
	return completed;
};

/**
 * Uploads the buffered reports. Concurrent calls share the upload in progress.
 * @param {Object} [options]
 * @param {(ip: string, entry: Object) => boolean} [options.validateEntry] Entries for which it returns false are removed without being sent.
 * @returns {Promise<boolean>} false if some entries could not be uploaded and remain in the buffer.
 */
const sendBulkReport = ({ validateEntry } = {}) => {
	currentUpload ??= performUpload(validateEntry).finally(() => {
		currentUpload = null;
	});

	return currentUpload;
};

module.exports = Object.freeze({
	saveBufferToFile,
	loadBufferFromFile,
	sendBulkReport,
	BULK_REPORT_BUFFER,
});
