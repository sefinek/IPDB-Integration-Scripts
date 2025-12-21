const FormData = require('form-data');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fs = require('node:fs/promises');
const path = require('node:path');
const { axiosBulk } = require('../services/axios.js');
const { saveReportedIPs, markIPAsReported } = require('../services/cache.js');
const logger = require('../logger.js');

const BULK_REPORT_BUFFER = new Map();
const BUFFER_FILE = path.join(__dirname, '..', '..', 'tmp', 'bulk-report-buffer.csv');
const ABUSE_STATE = { isLimited: false, isBuffering: false, sentBulk: false };
const OFFLINE_MODE = false;

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
		logger.error(`Failed to write buffer file: ${err.message}`, { ping: true });
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
		if (err.code !== 'ENOENT') logger.error(`Failed to parse/load buffer file: ${err.message}`);
	}
};

const sendBulkReport = async () => {
	if (!BULK_REPORT_BUFFER.size) return;

	logger.info(`Starting bulk report upload (${BULK_REPORT_BUFFER.size} IPs)...`, { discord: true });

	const records = Array.from(BULK_REPORT_BUFFER.entries(), ([ip, entry]) => [
		ip,
		entry.categories,
		new Date(entry.timestamp ?? Date.now()).toISOString(),
		entry.comment ? (entry.comment.length > 1024 ? entry.comment.substring(0, 1021) + '...' : entry.comment) : '',
	]);

	const sendChunk = async (chunk, index = 0, total = 1) => {
		const payload = stringify(chunk, {
			header: true,
			columns: ['IP', 'Categories', 'ReportDate', 'Comment'],
			quoted: true,
		});

		const lines = payload.split('\n').length;
		logger.success(`${total > 1 ? `Chunk ${index + 1}/${total}: ` : ''}Generated CSV with ${chunk.length} records, ${lines} lines`);

		if (OFFLINE_MODE) {
			if (lines > 10000) {
				const error = new Error('Line limit exceeded');
				error.response = {
					status: 422,
					data: { errors: [{ detail: `File uploaded has ${lines} lines which exceeds the line limit of 10,000 lines.`, status: 422 }] },
				};
				throw error;
			}

			const saved = chunk.length;
			logger.success(`${total > 1 ? `Chunk ${index + 1}/${total}: ` : 'Sent bulk report: '}${saved} accepted, 0 rejected [OFFLINE]`, { discord: true });
			return;
		}

		if (lines > 10000) {
			const error = new Error('Line limit exceeded');
			error.response = {
				status: 422,
				data: { errors: [{ detail: `File uploaded has ${lines} lines which exceeds the line limit of 10,000 lines.`, status: 422 }] },
			};
			throw error;
		}

		const form = new FormData();
		form.append('csv', Buffer.from(payload), {
			filename: total > 1 ? `report-chunk-${index + 1}.csv` : 'report.csv',
			contentType: 'text/csv',
		});

		const { data } = await axiosBulk.post('/bulk-report', form, { headers: { ...form.getHeaders() } });
		const saved = data?.data?.savedReports ?? 0;
		const failed = data?.data?.invalidReports?.length ?? 0;

		logger.success(`${total > 1 ? `Chunk ${index + 1}/${total}: ` : 'Sent bulk report: '}${saved} accepted, ${failed} rejected`, { discord: true });

		if (failed > 0) {
			const prefix = total > 1 ? `Chunk ${index + 1}: ` : '';
			data.data.invalidReports.forEach(fail => {
				logger.warn(`${prefix}Rejected [Row ${fail.rowNumber}] ${fail.input} -> ${fail.error}`);
			});
		}
	};

	const isLineLimitError = err =>
		err.response?.status === 422 &&
		err.response?.data?.errors?.some(e => e.detail.includes('exceeds the line limit'));

	let success = false;

	try {
		await sendChunk(records);
		success = true;
	} catch (err) {
		if (isLineLimitError(err)) {
			const chunks = [];
			const estimatedLinesPerRecord = 10;
			const chunkSize = Math.max(1, Math.floor(9000 / estimatedLinesPerRecord));

			for (let i = 0; i < records.length; i += chunkSize) {
				chunks.push(records.slice(i, i + chunkSize));
			}

			logger.info(`File too large. Splitting ${records.length} records into ${chunks.length} chunks (~${chunkSize} records each)`, { discord: true });

			let allChunksSuccessful = true;
			for (let i = 0; i < chunks.length; i++) {
				try {
					await sendChunk(chunks[i], i, chunks.length);
				} catch (chunkErr) {
					logger.error(`Chunk ${i + 1} failed: ${chunkErr.response?.data?.errors?.[0]?.detail || chunkErr.message}`);
					allChunksSuccessful = false;
				}
			}
			success = allChunksSuccessful;
		} else {
			const errorMsg = err.response?.data?.errors
				? err.response.data.errors.map(e => e.detail).join(', ')
				: err.response?.data ? JSON.stringify(err.response.data) : err.stack;

			logger.error(errorMsg);
		}
	}

	if (success) {
		for (const ip of BULK_REPORT_BUFFER.keys()) markIPAsReported(ip);
		await saveReportedIPs();
		BULK_REPORT_BUFFER.clear();

		try {
			await fs.unlink(BUFFER_FILE);
		} catch (err) {
			// Ignore file deletion errors - file may not exist or already deleted
			if (err.code !== 'ENOENT') logger.warn(`Failed to delete buffer file: ${err.message}`);
		}

		ABUSE_STATE.sentBulk = true;
	} else {
		logger.error('Bulk upload failed, keeping buffer file for retry', { ping: true });
	}
};

module.exports = Object.freeze({
	saveBufferToFile,
	loadBufferFromFile,
	sendBulkReport,
	BULK_REPORT_BUFFER,
});
