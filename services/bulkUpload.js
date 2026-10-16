const isLineLimitError = err =>
	err.response?.status === 422 &&
	err.response.data?.errors?.some(e => String(e.detail).includes('exceeds the line limit'));

const countLines = entry => (entry.comment || '').split('\n').length;

// Each chunk becomes one CSV file: 1 header line + the lines of its records
const splitByLines = (snapshot, maxLines) => {
	const chunks = [];
	let chunk = [], lines = 1;

	for (const item of snapshot) {
		const itemLines = countLines(item[1]);
		if (chunk.length && lines + itemLines > maxLines) {
			chunks.push(chunk);
			chunk = [];
			lines = 1;
		}

		chunk.push(item);
		lines += itemLines;
	}

	if (chunk.length) chunks.push(chunk);
	return chunks;
};

/**
 * Uploads [ip, entry] records in chunks that fit within the API line limit.
 * Once the API has accepted a chunk (2xx), its records are never sent again, even if the response is ambiguous,
 * because a resend would create duplicate reports.
 * @returns {Promise<boolean>} false if any chunk could not be uploaded (its records are left untouched).
 */
module.exports = async ({ snapshot, upload, accept, reject, settle, logger, maxLines = 9999 }) => {
	let completed = true;

	const handleResult = async (chunk, result) => {
		const rejected = new Map();
		for (const { input, error } of result?.invalidReports ?? []) {
			if (chunk.some(([ip]) => ip === input)) rejected.set(input, error || 'Rejected by API');
		}

		const expected = chunk.length - rejected.size;
		if (result?.savedReports !== expected) {
			logger.warn(`Bulk API reported ${result?.savedReports} saved record(s), expected ${expected}. Unidentified records are treated as sent to avoid duplicate reports.`);
		}

		for (const item of chunk) {
			const reason = rejected.get(item[0]);
			if (reason) await reject(item, reason);
			else await accept(item);
		}

		await settle?.();
	};

	const send = async chunk => {
		let result;
		try {
			result = await upload(chunk);
		} catch (err) {
			if (isLineLimitError(err) && chunk.length > 1) {
				const middle = Math.ceil(chunk.length / 2);
				await send(chunk.slice(0, middle));
				await send(chunk.slice(middle));
				return;
			}

			completed = false;
			logger.error(`Bulk upload failed, ${chunk.length} record(s) retained for retry: ${err.message}`);
			return;
		}

		try {
			await handleResult(chunk, result);
		} catch (err) {
			completed = false;
			logger.error(`Failed to process bulk upload result: ${err.message}`);
		}
	};

	for (const chunk of splitByLines(snapshot, maxLines)) await send(chunk);
	return completed;
};
