const { setup, stubModule, scriptsPath } = require('./helpers.js');
setup();
stubModule(scriptsPath('services/ipFetcher.js'), { getServerIPs: () => ['203.0.113.10', '2001:db8::10'] });

const test = require('node:test');
const assert = require('node:assert/strict');
const ipSanitizer = require('../ipSanitizer.js');

test('server IPs are masked in logged text', () => {
	assert.equal(ipSanitizer('ssh root@203.0.113.10 -p 22'), 'ssh root@[SOME-IP] -p 22');
	assert.equal(ipSanitizer('curl http://[2001:db8::10]/x 203.0.113.10'), 'curl http://[[SOME-IP]]/x [SOME-IP]');
});

test('other IPs and lookalikes are not masked', () => {
	assert.equal(ipSanitizer('203.0.113.1 203x0x113x10'), '203.0.113.1 203x0x113x10');
});
