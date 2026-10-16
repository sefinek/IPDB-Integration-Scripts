const test = require('node:test');
const assert = require('node:assert/strict');
const createProcessor = require('../suricata/createProcessor.js');

const tick = () => new Promise(resolve => setImmediate(resolve));

const deferred = () => {
	let resolve;
	const promise = new Promise(done => {
		resolve = done;
	});

	return { promise, resolve };
};

// Minimal policy: the event's src_ip is the offender, the evidence is the event itself
const policy = () => ({
	evaluate: event => (event?.event_type === 'alert' ? { srcIp: event.src_ip.replace('::ffff:', ''), review: Boolean(event.review), evidence: event } : null),
});

const line = (ip, extra = {}) => JSON.stringify({ event_type: 'alert', src_ip: ip, ...extra });

const setup = (options = {}) => {
	const marked = new Set(), reports = [], reviews = [], deferredData = [];
	const errors = [], warnings = [];
	let saves = 0;

	const processor = createProcessor({
		policy: policy(),
		report: async data => {
			reports.push(data.srcIp);
			return 'reported';
		},
		isReportedRecently: ip => marked.has(ip),
		markReported: ip => marked.add(ip),
		persistReported: async () => {
			saves++;
		},
		deferPending: async entries => deferredData.push(...entries),
		logReview: data => reviews.push(data.srcIp),
		logger: { warn: msg => warnings.push(msg), error: msg => errors.push(msg) },
		...options,
	});

	return { processor, marked, reports, reviews, deferredData, errors, saves: () => saves };
};

test('a reported IP is marked and persisted', async () => {
	const s = setup();
	await s.processor.processLine(line('8.8.8.8'));

	assert.deepEqual(s.reports, ['8.8.8.8']);
	assert.ok(s.marked.has('8.8.8.8'));
	assert.equal(s.saves(), 1);
});

test('parallel alerts for the same IP share one report', async () => {
	const gate = deferred();
	const s = setup({
		report: async () => {
			await gate.promise;
			return 'reported';
		},
	});

	const first = s.processor.processLine(line('8.8.8.8'));
	const second = s.processor.processLine(line('::ffff:8.8.8.8'));
	gate.resolve();
	await Promise.all([first, second]);
	await s.processor.processLine(line('8.8.8.8'));

	assert.equal(s.saves(), 1);
	assert.equal(s.marked.size, 1);
});

test('queued or failed reports are not marked as reported', async () => {
	for (const result of ['queued', 'failed']) {
		const s = setup({ report: async () => result });
		await s.processor.processLine(line('8.8.8.8'));
		assert.equal(s.marked.size, 0, result);
	}
});

test('a report error is logged and does not block the IP', async () => {
	let calls = 0;
	const s = setup({
		report: async () => {
			if (++calls === 1) throw new Error('timeout');
			return 'reported';
		},
	});

	await s.processor.processLine(line('8.8.8.8'));
	await s.processor.processLine(line('8.8.8.8'));

	assert.equal(calls, 2);
	assert.match(s.errors[0], /timeout/);
	assert.ok(s.marked.has('8.8.8.8'));
});

test('alerts matched by a rule in review are only logged', async () => {
	const s = setup();
	await s.processor.processLine(line('8.8.8.8', { review: true }));
	await s.processor.processLine(line('9.9.9.9'));

	assert.deepEqual(s.reviews, ['8.8.8.8']);
	assert.deepEqual(s.reports, ['9.9.9.9']);
	assert.equal(s.marked.has('8.8.8.8'), false);
});

test('non-alert, malformed and test lines are handled without reporting', async () => {
	const s = setup();
	await s.processor.processLine('{"event_type":"flow"}');
	await s.processor.processLine('{broken "alert"');
	await s.processor.processLine(undefined);
	assert.equal((await s.processor.processLine(line('8.8.8.8'), true)).srcIp, '8.8.8.8');

	assert.deepEqual(s.reports, []);
});

test('the policy is evaluated again before a queued report is sent', async () => {
	const gate = deferred();
	let blocked = false;
	const s = setup({
		maxConcurrent: 1,
		policy: {
			evaluate: event => (blocked && event.src_ip === '9.9.9.9' ? null : policy().evaluate(event)),
		},
		report: async data => {
			await gate.promise;
			s.reports.push(data.srcIp);
			return 'reported';
		},
	});

	const first = s.processor.processLine(line('8.8.8.8'));
	const second = s.processor.processLine(line('9.9.9.9'));
	blocked = true;
	gate.resolve();
	await Promise.all([first, second]);

	assert.deepEqual(s.reports, ['8.8.8.8']);
});

test('concurrency and the pending queue are limited', async () => {
	const gate = deferred();
	let active = 0, maxActive = 0;
	const s = setup({
		maxConcurrent: 2,
		maxPending: 3,
		report: async () => {
			maxActive = Math.max(maxActive, ++active);
			await gate.promise;
			active--;
			return 'reported';
		},
	});

	const lines = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'].map(ip => s.processor.processLine(line(ip)));
	await tick();
	gate.resolve();
	await Promise.all(lines);

	assert.equal(maxActive, 2);
	assert.equal(s.marked.size, 3);
	assert.equal(s.marked.has('4.4.4.4'), false);
});

test('stop() saves queued alerts, waits for active ones and rejects new lines', async () => {
	const gate = deferred();
	const s = setup({
		maxConcurrent: 1,
		report: async () => {
			await gate.promise;
			return 'reported';
		},
	});

	const active = s.processor.processLine(line('8.8.8.8'));
	const queued = s.processor.processLine(line('9.9.9.9'));
	await tick();

	const stopping = s.processor.stop();
	await tick();
	assert.deepEqual(s.deferredData.map(data => data.srcIp), ['9.9.9.9']);

	gate.resolve();
	await Promise.all([active, queued, stopping]);
	assert.deepEqual([...s.marked], ['8.8.8.8']);

	await s.processor.processLine(line('4.4.4.4'));
	assert.equal(s.marked.has('4.4.4.4'), false);
});

test('invalid queue limits are rejected', () => {
	assert.throws(() => setup({ maxConcurrent: 0 }));
	assert.throws(() => setup({ maxConcurrent: 4, maxPending: 2 }));
});
