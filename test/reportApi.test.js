const { setup } = require('./helpers.js');
setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve, ADAPTERS } = require('../services/reportApi.js');

const httpError = (status, data, message = `Request failed with status code ${status}`) => Object.assign(new Error(message), { response: { status, data } });

test('the adapter is chosen from the repository name', () => {
	assert.equal(resolve('Suricata-To-AbuseIPDB'), ADAPTERS.abuseipdb);
	assert.equal(resolve('UFW-SniffCat-Reporter'), ADAPTERS.sniffcat);
	assert.throws(() => resolve('Something-Else'), /No report API adapter/);
});

test('AbuseIPDB', () => {
	const api = ADAPTERS.abuseipdb;
	assert.equal(api.supportsBulk, true);
	assert.equal(api.getScore({ data: { ipAddress: '8.8.8.8', abuseConfidenceScore: 52 } }), 52);
	assert.equal(api.getScore(undefined), undefined);

	const dailyLimit = httpError(429, { errors: [{ detail: 'Daily rate limit of 1000 requests exceeded for this endpoint.', status: 429 }] });
	assert.equal(api.isDailyLimit(dailyLimit), true);
	assert.equal(api.isDailyLimit(httpError(429, { errors: [{ detail: 'Too Many Requests', status: 429 }] })), false);
	assert.equal(api.formatError(dailyLimit), JSON.stringify(dailyLimit.response.data.errors));
	assert.equal(api.formatError(new Error('timeout of 30000ms exceeded')), 'timeout of 30000ms exceeded');
});

test('SniffCat', () => {
	const api = ADAPTERS.sniffcat;
	assert.equal(api.supportsBulk, false);
	assert.equal(api.getScore({ success: true, status: 200, message: 'Success', abuseConfidenceScore: 31, previousScore: 20, delta: 11 }), 31);

	const dailyLimit = httpError(429, { success: false, status: 429, message: 'You have reached the report limit (1000) for your role.' });
	const perIp = httpError(429, { success: false, status: 429, message: 'You can only report this IP once every 20 minutes. Try again in 512 seconds.' });
	assert.equal(api.isDailyLimit(dailyLimit), true);
	assert.equal(api.isDailyLimit(perIp), false);
	assert.equal(api.formatError(perIp), 'You can only report this IP once every 20 minutes. Try again in 512 seconds.');
	assert.equal(api.formatError(new Error('socket hang up')), 'socket hang up');
});
