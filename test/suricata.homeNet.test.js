const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempDir } = require('./helpers.js');
const { loadHomeNet, parseHomeNet } = require('../suricata/homeNet.js');

const YAML = `%YAML 1.1
---
vars:
  # HOME_NET: "[192.168.0.0/16]"
  address-groups:
    HOME_NET: "[10.0.0.0/27,192.168.160.0/29,2a01:11bf:4404:9000::/56]"   # comment
    EXTERNAL_NET: "!$HOME_NET"
`;

const writeConfig = content => {
	const file = path.join(createTempDir(), 'suricata.yaml');
	fs.writeFileSync(file, content);
	return file;
};

test('HOME_NET is loaded from suricata.yaml, ignoring comments', () => {
	const homeNet = loadHomeNet(writeConfig(YAML));
	assert.deepEqual(homeNet.networks, ['10.0.0.0/27', '192.168.160.0/29', '2a01:11bf:4404:9000::/56']);
	assert.equal(homeNet.contains('10.0.0.13'), true);
	assert.equal(homeNet.contains('10.0.0.32'), false);
	assert.equal(homeNet.contains('2a01:11bf:4404:90ff::1'), true);
	assert.equal(homeNet.contains('2a01:11bf:4404:9100::1'), false);
	assert.equal(homeNet.contains('8.8.8.8'), false);
});

test('single quotes, no quotes and Windows line endings are supported', () => {
	assert.ok(loadHomeNet(writeConfig('HOME_NET: \'[10.0.0.0/8]\'\n')).contains('10.1.2.3'));
	assert.ok(loadHomeNet(writeConfig('HOME_NET: [10.0.0.0/8]\n')).contains('10.1.2.3'));
	assert.ok(loadHomeNet(writeConfig('vars:\r\n  HOME_NET: "[10.0.0.0/8]"\r\n')).contains('10.1.2.3'));
});

test('single addresses and a value without brackets are supported', () => {
	const homeNet = parseHomeNet('10.0.0.1, 2001:db8::1');
	assert.equal(homeNet.contains('10.0.0.1'), true);
	assert.equal(homeNet.contains('10.0.0.2'), false);
	assert.equal(homeNet.contains('2001:db8::1'), true);
});

test('negated entries are excluded', () => {
	const homeNet = parseHomeNet('[10.0.0.0/8,!10.0.5.0/24, ! 10.0.6.1]');
	assert.equal(homeNet.contains('10.0.4.1'), true);
	assert.equal(homeNet.contains('10.0.5.1'), false);
	assert.equal(homeNet.contains('10.0.6.1'), false);
});

test('unsupported and invalid values are rejected', () => {
	for (const value of ['', '[]', 'any', '[any]', '[$OTHER_NET]', '[[10.0.0.0/8]]', '[0.0.0.0/0]', '[::/0]', '[10.0.0.0/33]', '[invalid]', '[!10.0.0.0/8]']) {
		assert.throws(() => parseHomeNet(value), Error, value);
	}
});

test('a missing, ambiguous or unreadable file is reported clearly', () => {
	assert.throws(() => loadHomeNet(writeConfig('vars:\n  address-groups:\n')), /HOME_NET was not found/);
	assert.throws(() => loadHomeNet(writeConfig('HOME_NET: "[10.0.0.0/8]"\nHOME_NET: "[10.1.0.0/16]"\n')), /defined 2 times/);
	assert.throws(() => loadHomeNet(path.join(createTempDir(), 'missing.yaml')), err => {
		assert.match(err.message, /Cannot read .*suricata' group/);
		assert.equal(err.cause.code, 'ENOENT');
		return true;
	});
});

test('the cause of an invalid entry is preserved', () => {
	assert.throws(() => loadHomeNet(writeConfig('HOME_NET: "[10.0.0.0/8,0.0.0.0/0]"\n')), err => {
		assert.match(err.message, /Invalid HOME_NET in /);
		assert.equal(err.cause.message, 'Invalid HOME_NET entry "0.0.0.0/0"');
		assert.equal(err.cause.cause.message, 'Default routes are not allowed');
		return true;
	});
});
