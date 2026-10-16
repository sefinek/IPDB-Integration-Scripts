const { setup, stubModule, scriptsPath } = require('./helpers.js');
const { logger } = setup({ IP_ASSIGNMENT: 'static', IPv6_SUPPORT: true });

const responses = { 4: [], 6: [] };
stubModule(scriptsPath('services/axios.js'), {
	axiosSefinek: {
		get: async (_url, { httpsAgent }) => {
			const next = responses[httpsAgent.options.family].shift() ?? new Error('No response queued');
			if (next instanceof Error) throw next;
			return { data: next };
		},
	},
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { refreshServerIPs, getServerIPs } = require('../services/ipFetcher.js');

const ok = ip => ({ success: true, message: ip });

// IPv6 is retried with a delay. Advances the mocked clock until the refresh finishes.
const refresh = async t => {
	t.mock.timers.enable({ apis: ['setTimeout'] });

	let done = false;
	const refreshing = refreshServerIPs().finally(() => {
		done = true;
	});

	while (!done) {
		await new Promise(resolve => setImmediate(resolve));
		t.mock.timers.tick(5000);
	}

	return refreshing;
};

test('public IPv4 and IPv6 addresses are added in normalized form', async t => {
	responses[4].push(ok('8.8.8.8'));
	responses[6].push(ok('2001:4860:4860:0:0:0:0:8888'));

	await refresh(t);
	assert.ok(getServerIPs().includes('8.8.8.8'));
	assert.ok(getServerIPs().includes('2001:4860:4860::8888'));
});

test('the last known address is kept when a refresh fails', async t => {
	responses[4].push(new Error('timeout'));

	await refresh(t);
	assert.ok(getServerIPs().includes('8.8.8.8'));
	assert.ok(getServerIPs().includes('2001:4860:4860::8888'));
	assert.ok(logger.messages.error.some(msg => msg.includes('IPv6 address after 6 attempt(s)') && msg.includes('Keeping the last known address: 2001:4860:4860::8888')));
});

test('IPv6 is retried before giving up', async t => {
	responses[4].push(ok('8.8.8.8'));
	responses[6].push(new Error('timeout'), new Error('timeout'), ok('2606:4700:4700::1111'));

	await refresh(t);
	assert.ok(getServerIPs().includes('2606:4700:4700::1111'));
	assert.equal(getServerIPs().includes('2001:4860:4860::8888'), false);
});

test('a changed public IP replaces the old one', async t => {
	responses[4].push(ok('1.1.1.1'));
	responses[6].push(ok('2620:fe::fe'));

	await refresh(t);
	assert.ok(getServerIPs().includes('1.1.1.1'));
	assert.equal(getServerIPs().includes('8.8.8.8'), false);
	assert.equal(getServerIPs().includes('2606:4700:4700::1111'), false);
});

test('private, reserved, wrong-family and failed responses are rejected', async t => {
	responses[4].push(ok('10.0.0.1'));
	responses[6].push(ok('9.9.9.9'), ok('2001:db8::1'), { success: false, message: '2620:fe::9' });

	await refresh(t);
	for (const ip of ['10.0.0.1', '9.9.9.9', '2001:db8::1', '2620:fe::9']) assert.equal(getServerIPs().includes(ip), false, ip);
	assert.ok(getServerIPs().includes('1.1.1.1'));
	assert.ok(getServerIPs().includes('2620:fe::fe'));
});

test('concurrent refreshes share one request', async t => {
	responses[4].push(ok('1.1.1.1'));
	responses[6].push(ok('2620:fe::fe'));

	assert.equal(refreshServerIPs(), refreshServerIPs());
	await refresh(t);
	assert.equal(responses[4].length, 0);
	assert.equal(responses[6].length, 0);
});
