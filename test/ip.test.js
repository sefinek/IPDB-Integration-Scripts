const test = require('node:test');
const assert = require('node:assert/strict');
const normalizeIP = require('../normalizeIP.js');
const isSpecialPurposeIP = require('../isSpecialPurposeIP.js');

test('normalizeIP returns the canonical form of IPv4 and IPv6 addresses', () => {
	assert.equal(normalizeIP('8.8.8.8'), '8.8.8.8');
	assert.equal(normalizeIP(' 8.8.8.8 '), '8.8.8.8');
	assert.equal(normalizeIP('2001:4860:4860:0000:0000:0000:0000:8888'), '2001:4860:4860::8888');
	assert.equal(normalizeIP('2001:4860:4860:0:0:0:0:8888'), '2001:4860:4860::8888');
	assert.equal(normalizeIP('2A01:11BF::1'), '2a01:11bf::1');
});

test('normalizeIP converts IPv4-mapped IPv6 to IPv4', () => {
	assert.equal(normalizeIP('::ffff:8.8.8.8'), '8.8.8.8');
	assert.equal(normalizeIP('::ffff:808:808'), '8.8.8.8');
});

test('normalizeIP rejects invalid input, legacy IPv4 forms and zone IDs', () => {
	for (const value of ['', 'invalid', '999.1.1.1', '1.2.3', '134744072', '0x08080808', '010.0.0.1', 'fe80::1%eth0', null, undefined, 123, {}]) {
		assert.equal(normalizeIP(value), null, `expected null for ${value}`);
	}
});

test('isSpecialPurposeIP detects local and special ranges', () => {
	for (const ip of ['10.0.0.1', '192.168.1.1', '172.16.0.1', '127.0.0.1', '100.64.0.1', '169.254.1.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fd00::1', 'ff02::1']) {
		assert.equal(isSpecialPurposeIP(ip).is, true, ip);
	}
});

test('isSpecialPurposeIP accepts public addresses', () => {
	for (const ip of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888', '2a01:11bf:4404:9019::1']) {
		const result = isSpecialPurposeIP(ip);
		assert.equal(result.is, false, ip);
		assert.equal(result.range, 'unicast');
	}
});

test('isSpecialPurposeIP checks IPv4-mapped IPv6 by its IPv4 address', () => {
	assert.equal(isSpecialPurposeIP('::ffff:10.0.0.1').is, true);
	assert.equal(isSpecialPurposeIP('::ffff:8.8.8.8').is, false);
});

test('isSpecialPurposeIP treats invalid input as special, so it is never reported', () => {
	assert.deepEqual(isSpecialPurposeIP('invalid'), { is: true, range: null });
	assert.deepEqual(isSpecialPurposeIP('134744072'), { is: true, range: null });
	assert.deepEqual(isSpecialPurposeIP(undefined), { is: true, range: null });
});
