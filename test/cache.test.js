const fs = require('node:fs');
const path = require('node:path');
const { setup, createTempDir } = require('./helpers.js');

const CACHE_FILE = path.join(createTempDir(), 'nested', 'reported_ips.txt');
const COOLDOWN = 60 * 60 * 1000;
const { logger } = setup({ CACHE_FILE, IP_REPORT_COOLDOWN: COOLDOWN });

const test = require('node:test');
const assert = require('node:assert/strict');
const { reportedIPs, loadReportedIPs, saveReportedIPs, isIPReportedRecently, markIPAsReported } = require('../services/cache.js');

const now = () => Math.floor(Date.now() / 1000);

test.beforeEach(() => reportedIPs.clear());

test('marked IPs are in cooldown under their normalized form', () => {
	markIPAsReported('::ffff:8.8.8.8');
	assert.ok(reportedIPs.has('8.8.8.8'));
	assert.equal(isIPReportedRecently('8.8.8.8'), true);
	assert.equal(isIPReportedRecently('::ffff:8.8.8.8'), true);

	markIPAsReported('2001:4860:4860:0:0:0:0:8888');
	assert.equal(isIPReportedRecently('2001:4860:4860::8888'), true);
});

test('cooldown expires', () => {
	reportedIPs.set('8.8.8.8', now() - COOLDOWN / 1000 - 1);
	assert.equal(isIPReportedRecently('8.8.8.8'), false);
	assert.equal(isIPReportedRecently('1.1.1.1'), false);
});

test('marking an invalid IP is ignored and logged', () => {
	markIPAsReported('invalid');
	assert.equal(reportedIPs.size, 0);
	assert.match(logger.messages.warn.at(-1), /invalid IP address as reported: invalid/);
});

test('cache is saved and loaded back, creating the directory', async () => {
	markIPAsReported('8.8.8.8');
	markIPAsReported('2001:db8::1');
	await saveReportedIPs();
	assert.ok(fs.existsSync(CACHE_FILE));

	reportedIPs.clear();
	await loadReportedIPs();
	assert.deepEqual([...reportedIPs.keys()].sort(), ['2001:db8::1', '8.8.8.8']);
});

test('loading skips invalid IPs, invalid times and future timestamps', async () => {
	const time = now() - 60;
	fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
	fs.writeFileSync(CACHE_FILE, [
		`8.8.8.8 ${time}`,
		`invalid ${time}`,
		'1.1.1.1 abc',
		'9.9.9.9 -5',
		`4.4.4.4 ${time + 3600}`,
		'',
		`  2001:0db8:0000:0000:0000:0000:0000:0001   ${time}  `,
	].join('\n'));

	await loadReportedIPs();
	assert.deepEqual(Object.fromEntries(reportedIPs), { '8.8.8.8': time, '2001:db8::1': time });
});

test('duplicate entries keep the most recent time', async () => {
	const time = now();
	fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
	fs.writeFileSync(CACHE_FILE, `8.8.8.8 ${time - 100}\n::ffff:8.8.8.8 ${time - 10}\n8.8.8.8 ${time - 50}`);

	await loadReportedIPs();
	assert.equal(reportedIPs.get('8.8.8.8'), time - 10);
});

test('a missing cache file is not an error', async () => {
	fs.rmSync(CACHE_FILE, { force: true });
	await assert.doesNotReject(loadReportedIPs());
	assert.equal(reportedIPs.size, 0);
});
