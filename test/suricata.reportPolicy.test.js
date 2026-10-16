const { setup } = require('./helpers.js');
setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHomeNet } = require('../suricata/homeNet.js');
const createPolicy = require('../suricata/reportPolicy.js');

const homeNet = parseHomeNet('[10.0.0.0/8,2a01:11bf:4404:9000::/56]');

const CONFIG = {
	REPORT_MODE: 'report',
	REPORT_RULES: [{ signatureId: 100, offender: 'src', flags: ['PORT_SCAN', 'HACKING'] }],
	MIN_ALERT_SEVERITY: 2,
	ALLOWED_VERDICT_ACTIONS: ['alert', 'drop'],
};

const policyFor = (config = {}, deps = {}) => createPolicy({ ...CONFIG, ...config }, { isHomeNet: homeNet.contains, ...deps });

const event = changes => ({
	event_type: 'alert',
	timestamp: new Date().toISOString(),
	src_ip: '8.8.8.8',
	dest_ip: '10.0.0.13',
	src_port: 51234,
	dest_port: 22,
	proto: 'TCP',
	alert: { signature_id: 100, severity: 1, signature: 'Test alert' },
	...changes,
});

test('an external source targeting HOME_NET is reported with mapped categories', () => {
	const data = policyFor().evaluate(event());
	assert.equal(data.srcIp, '8.8.8.8');
	assert.equal(data.categories, '14,15');
	assert.equal(data.dpt, 22);
	assert.equal(data.proto, 'TCP');
	assert.equal(data.signature, 'Test alert');
});

test('the offender direction is taken from the rule, never guessed', () => {
	const outgoing = event({ src_ip: '10.0.0.13', dest_ip: '8.8.8.8' });
	assert.equal(policyFor().evaluate(outgoing), null);

	const destPolicy = policyFor({ REPORT_RULES: [{ signatureId: 100, offender: 'dest', flags: ['CNC_BEACONING'] }] });
	assert.equal(destPolicy.evaluate(outgoing).srcIp, '8.8.8.8');
	assert.equal(destPolicy.evaluate(event()), null);
});

test('both sides must match: offender outside and peer inside HOME_NET', () => {
	const policy = policyFor();
	assert.equal(policy.evaluate(event({ dest_ip: '9.9.9.9' })), null);
	assert.equal(policy.evaluate(event({ src_ip: '10.0.0.5' })), null);
	assert.equal(policy.evaluate(event({ src_ip: '2a01:11bf:4404:900a::31' })), null);
	assert.equal(policy.evaluate(event({ dest_ip: '2a01:11bf:4404:900a:0:0:0:31' })).srcIp, '8.8.8.8');
});

test('a remote host that only replied to a local connection is not reported', () => {
	const policy = policyFor();
	assert.equal(policy.evaluate(event({ flow: { src_ip: '10.0.0.13' } })), null);
	assert.equal(policy.evaluate(event({ flow: { src_ip: '::ffff:8.8.8.8' } })).srcIp, '8.8.8.8');

	const data = policy.evaluate(event({ flow: { src_ip: '8.8.8.8', bytes_toserver: 100 } }));
	assert.deepEqual(data.evidence.flow, { src_ip: '8.8.8.8' });

	const destPolicy = policyFor({ REPORT_RULES: [{ signatureId: 100, offender: 'dest', flags: ['CNC_BEACONING'] }] });
	assert.equal(destPolicy.evaluate(event({ src_ip: '10.0.0.13', dest_ip: '8.8.8.8', flow: { src_ip: '10.0.0.13' } })).srcIp, '8.8.8.8');
});

test('special-purpose and server IPs are never reported', () => {
	const policy = policyFor({}, { getServerIPs: () => ['2001:4860:4860::8888'] });
	assert.equal(policy.evaluate(event({ src_ip: '192.168.1.1' })), null);
	assert.equal(policy.evaluate(event({ src_ip: '2001:4860:4860:0:0:0:0:8888' })), null);
	assert.equal(policy.canReportIP('2001:4860:4860::8888'), false);
	assert.equal(policy.canReportIP('8.8.8.8'), true);
	assert.equal(policy.canReportIP('invalid'), false);
});

test('IPv4-mapped addresses are normalized', () => {
	assert.equal(policyFor().evaluate(event({ src_ip: '::ffff:8.8.8.8' })).srcIp, '8.8.8.8');
});

test('whitelisted IPs and ignored signatures are skipped', () => {
	assert.equal(policyFor({}, { isWhitelisted: ip => ip === '8.8.8.8' }).evaluate(event()), null);
	assert.equal(policyFor({}, { isIgnored: id => id === 100 }).evaluate(event()), null);
});

test('severity, verdict and signature filters are applied', () => {
	const policy = policyFor();
	assert.equal(policy.evaluate(event({ alert: { signature_id: 100, severity: 3 } })), null);
	assert.equal(policy.evaluate(event({ alert: { signature_id: 999, severity: 1 } })), null);
	assert.equal(policy.evaluate(event({ verdict: { action: 'pass' } })), null);
	assert.ok(policy.evaluate(event({ verdict: { action: 'drop' } })));
});

test('malformed events are rejected', () => {
	const policy = policyFor();
	for (const changes of [
		{ event_type: 'flow' },
		{ alert: null },
		{ alert: {} },
		{ alert: { signature_id: 100, severity: '1' } },
		{ alert: { signature_id: '100', severity: 1 } },
		{ alert: { signature_id: 100, severity: 0 } },
		{ src_ip: 'invalid' },
		{ dest_ip: undefined },
		{ timestamp: 'invalid' },
		{ timestamp: 1234567890 },
		{ timestamp: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
	]) {
		assert.equal(policy.evaluate(event(changes)), null, JSON.stringify(changes));
	}

	assert.equal(policy.evaluate(null), null);
});

test('Suricata timestamps keep their timezone', () => {
	const data = policyFor().evaluate(event({ timestamp: '2026-10-15T12:00:00.123456+0200' }));
	assert.equal(data.timestamp, Date.parse('2026-10-15T10:00:00.123Z'));
});

test('the evidence contains only metadata and can be evaluated again', () => {
	const policy = policyFor();
	const data = policy.evaluate(event({ http: { http_request_body: 'pwd=secret' }, payload: 'AAAA' }));

	assert.equal(JSON.stringify(data.evidence).includes('secret'), false);
	assert.equal(data.evidence.payload, undefined);
	assert.deepEqual(policy.evaluate(data.evidence), data);
});

test('skip reasons are reported only when requested', () => {
	const reasons = [];
	policyFor().evaluate(event({ alert: { signature_id: 999, severity: 1 } }), reason => reasons.push(reason));
	assert.match(reasons[0], /999 has no entry in REPORT_RULES/);
});

test('review is the default mode and allows empty rules', () => {
	const policy = policyFor({ REPORT_MODE: undefined, REPORT_RULES: undefined });
	assert.equal(policy.mode, 'review');
	assert.equal(policy.evaluate(event()), null);
});

test('invalid configuration is rejected', () => {
	const rule = CONFIG.REPORT_RULES[0];
	for (const config of [
		{ REPORT_MODE: 'invalid' },
		{ REPORT_RULES: [] },
		{ REPORT_RULES: {} },
		{ REPORT_RULES: [null] },
		{ REPORT_RULES: [{ ...rule, signatureId: 0 }] },
		{ REPORT_RULES: [{ ...rule, offender: 'either' }] },
		{ REPORT_RULES: [{ ...rule, flags: [] }] },
		{ REPORT_RULES: [{ ...rule, flags: ['NOT_A_FLAG'] }] },
		{ REPORT_RULES: [rule, rule] },
	]) {
		assert.throws(() => policyFor(config), Error, JSON.stringify(config));
	}

	assert.throws(() => createPolicy(CONFIG, {}), /isHomeNet/);
});
