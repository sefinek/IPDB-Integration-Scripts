const { setup } = require('./helpers.js');
const { logger } = setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const createCaptureMonitor = require('../integrations/suricata/captureMonitor.js');

const MINUTE = 60 * 1000;
const stats = pkts => JSON.stringify({ event_type: 'stats', stats: { decoder: { pkts } } });

const createClock = () => {
	let time = 0;
	return { now: () => time, advance: ms => (time += ms) };
};

const setupMonitor = () => {
	const clock = createClock();
	const monitor = createCaptureMonitor({ logger, stallTimeout: 15 * MINUTE, now: clock.now });
	return { clock, monitor };
};

test.beforeEach(() => {
	for (const list of Object.values(logger.messages)) list.length = 0;
});

test('stays silent without any stats events', () => {
	const { clock, monitor } = setupMonitor();
	clock.advance(60 * MINUTE);
	monitor.check();
	assert.deepEqual(logger.messages.warn, []);
});

test('ignores other events and malformed lines', () => {
	const { clock, monitor } = setupMonitor();
	monitor.onLine('{"event_type":"alert"}');
	monitor.onLine('{"event_type":"stats", broken');
	monitor.onLine(JSON.stringify({ event_type: 'stats', stats: {} }));
	clock.advance(60 * MINUTE);
	monitor.check();
	assert.deepEqual(logger.messages.warn, []);
});

test('does not warn while packets keep increasing', () => {
	const { clock, monitor } = setupMonitor();
	for (let i = 1; i <= 40; i++) {
		monitor.onLine(stats(i * 1000));
		clock.advance(MINUTE);
		monitor.check();
	}
	assert.deepEqual(logger.messages.warn, []);
});

test('warns once when packets stop, and reports the recovery', () => {
	const { clock, monitor } = setupMonitor();
	monitor.onLine(stats(1000));

	for (let i = 0; i < 30; i++) {
		clock.advance(MINUTE);
		monitor.onLine(stats(1000));
		monitor.check();
	}

	assert.equal(logger.messages.warn.length, 1);
	assert.match(logger.messages.warn[0], /not received any packets for 15 minutes \(decoder\.pkts stuck at 1000\)/);

	monitor.onLine(stats(1500));
	assert.match(logger.messages.success.at(-1), /receiving packets again/);

	clock.advance(20 * MINUTE);
	monitor.onLine(stats(1500));
	monitor.check();
	assert.equal(logger.messages.warn.length, 2);
});

test('warns once when stats events stop', () => {
	const { clock, monitor } = setupMonitor();
	monitor.onLine(stats(1000));

	clock.advance(16 * MINUTE);
	monitor.check();
	monitor.check();

	assert.equal(logger.messages.warn.length, 1);
	assert.match(logger.messages.warn[0], /No stats events in eve\.json for 16 minutes/);
});

test('a counter reset after a Suricata restart counts as traffic', () => {
	const { clock, monitor } = setupMonitor();
	monitor.onLine(stats(1000000));
	clock.advance(10 * MINUTE);
	monitor.onLine(stats(50));
	clock.advance(10 * MINUTE);
	monitor.onLine(stats(50));
	monitor.check();
	assert.deepEqual(logger.messages.warn, []);
});
