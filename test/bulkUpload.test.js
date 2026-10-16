const test = require('node:test');
const assert = require('node:assert/strict');
const uploadSnapshot = require('../services/bulkUpload.js');

const record = (ip, comment = 'comment') => [ip, { categories: '14', comment }];

const lineLimitError = () => Object.assign(new Error('Line limit exceeded'), {
	response: { status: 422, data: { errors: [{ detail: 'File uploaded has 12000 lines which exceeds the line limit of 10,000 lines.' }] } },
});

const run = (snapshot, upload, options = {}) => {
	const accepted = [], rejected = [], uploads = [];
	const logger = { warn: [], error: [] };
	let settles = 0;

	const promise = uploadSnapshot({
		snapshot,
		upload: async chunk => {
			uploads.push(chunk.map(([ip]) => ip));
			return upload(chunk);
		},
		accept: async ([ip]) => accepted.push(ip),
		reject: async ([ip], reason) => rejected.push([ip, reason]),
		settle: async () => settles++,
		logger: { warn: msg => logger.warn.push(msg), error: msg => logger.error.push(msg) },
		...options,
	});

	return promise.then(completed => ({ completed, accepted, rejected, uploads, logger, settles }));
};

const success = chunk => ({ savedReports: chunk.length, invalidReports: [] });

test('all records are accepted after a successful upload', async () => {
	const r = await run([record('1.1.1.1'), record('2.2.2.2')], success);
	assert.equal(r.completed, true);
	assert.deepEqual(r.accepted, ['1.1.1.1', '2.2.2.2']);
	assert.deepEqual(r.uploads, [['1.1.1.1', '2.2.2.2']]);
	assert.equal(r.settles, 1);
});

test('an empty snapshot uploads nothing', async () => {
	const r = await run([], success);
	assert.equal(r.completed, true);
	assert.equal(r.uploads.length, 0);
});

test('records rejected by the API are separated from accepted ones', async () => {
	const r = await run([record('1.1.1.1'), record('2.2.2.2'), record('3.3.3.3')], () => ({
		savedReports: 2,
		invalidReports: [{ input: '2.2.2.2', error: 'Duplicate IP', rowNumber: 2 }],
	}));

	assert.equal(r.completed, true);
	assert.deepEqual(r.accepted, ['1.1.1.1', '3.3.3.3']);
	assert.deepEqual(r.rejected, [['2.2.2.2', 'Duplicate IP']]);
	assert.equal(r.logger.warn.length, 0);
});

test('an ambiguous 2xx response does not lead to a resend', async () => {
	const r = await run([record('1.1.1.1'), record('2.2.2.2')], () => ({
		savedReports: 0,
		invalidReports: [{ input: 'not-in-chunk', error: 'Invalid IP' }],
	}));

	assert.equal(r.completed, true);
	assert.deepEqual(r.accepted, ['1.1.1.1', '2.2.2.2']);
	assert.equal(r.logger.warn.length, 1);
});

test('a failed upload keeps its records untouched', async () => {
	const r = await run([record('1.1.1.1')], () => {
		throw new Error('timeout');
	});

	assert.equal(r.completed, false);
	assert.deepEqual(r.accepted, []);
	assert.deepEqual(r.rejected, []);
	assert.equal(r.settles, 0);
	assert.match(r.logger.error[0], /timeout/);
});

test('records are split so each CSV fits within the line limit', async () => {
	const snapshot = [record('1.1.1.1', 'a\nb\nc'), record('2.2.2.2', 'a\nb'), record('3.3.3.3', 'a\nb\nc\nd')];
	const r = await run(snapshot, success, { maxLines: 6 });

	assert.deepEqual(r.uploads, [['1.1.1.1', '2.2.2.2'], ['3.3.3.3']]);
	assert.equal(r.settles, 2);
});

test('a record larger than the limit is still sent on its own', async () => {
	const r = await run([record('1.1.1.1', 'a\nb\nc\nd\ne')], success, { maxLines: 3 });
	assert.deepEqual(r.uploads, [['1.1.1.1']]);
});

test('a line limit error splits the chunk in half and retries', async () => {
	const snapshot = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4', '5.5.5.5'].map(ip => record(ip));
	const r = await run(snapshot, chunk => {
		if (chunk.length > 2) throw lineLimitError();
		return success(chunk);
	});

	assert.equal(r.completed, true);
	assert.deepEqual(r.uploads, [
		['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4', '5.5.5.5'],
		['1.1.1.1', '2.2.2.2', '3.3.3.3'],
		['1.1.1.1', '2.2.2.2'],
		['3.3.3.3'],
		['4.4.4.4', '5.5.5.5'],
	]);
	assert.equal(r.accepted.length, 5);
});

test('a line limit error on a single record fails instead of looping', async () => {
	const r = await run([record('1.1.1.1')], () => {
		throw lineLimitError();
	});

	assert.equal(r.completed, false);
	assert.equal(r.uploads.length, 1);
});

test('a failed chunk does not stop the remaining chunks', async () => {
	const snapshot = [record('1.1.1.1', 'a\nb'), record('2.2.2.2', 'a\nb')];
	const r = await run(snapshot, chunk => {
		if (chunk[0][0] === '1.1.1.1') throw new Error('timeout');
		return success(chunk);
	}, { maxLines: 3 });

	assert.equal(r.completed, false);
	assert.deepEqual(r.accepted, ['2.2.2.2']);
});

test('a failure while saving the result is reported, not thrown', async () => {
	const r = await run([record('1.1.1.1')], success, {
		settle: async () => {
			throw new Error('disk full');
		},
	});

	assert.equal(r.completed, false);
	assert.match(r.logger.error[0], /disk full/);
});
