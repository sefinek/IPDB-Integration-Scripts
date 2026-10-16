const { setup } = require('./helpers.js');
setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHomeNet } = require('../suricata/homeNet.js');
const createPolicy = require('../suricata/reportPolicy.js');

const homeNet = parseHomeNet('[10.0.0.0/8,2a01:11bf:4404:9000::/56]');

const CONFIG = {
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
	alert: { signature_id: 100, severity: 1, signature: 'Test alert', category: 'Misc Attack' },
	...changes,
});

test('an external host connecting to HOME_NET is reported', () => {
	const data = policyFor().evaluate(event());
	assert.equal(data.srcIp, '8.8.8.8');
	assert.equal(data.categories, '15');
	assert.equal(data.dpt, 22);
	assert.equal(data.proto, 'TCP');
	assert.equal(data.signature, 'Test alert');
});

test('categories are based on the alert classification', () => {
	const categoryOf = category => policyFor().evaluate(event({ alert: { signature_id: 100, severity: 1, category } })).categories;
	assert.equal(categoryOf('Detection of a Network Scan'), '14');
	assert.equal(categoryOf('Attempted Information Leak'), '14');
	assert.equal(categoryOf('Web Application Attack'), '21');
	assert.equal(categoryOf('Attempted Denial of Service'), '4');
	assert.equal(categoryOf('Unknown classtype'), '15');
	assert.equal(categoryOf(undefined), '15');
});

test('hosts contacted from the local network are never reported', () => {
	const policy = policyFor();

	// Outgoing packet, e.g. a DNS query to a resolver
	assert.equal(policy.evaluate(event({ src_ip: '10.0.0.13', dest_ip: '8.8.8.8' })), null);

	// Reply to a local connection (Suricata 7+ flow initiator)
	assert.equal(policy.evaluate(event({ flow: { src_ip: '10.0.0.13' } })), null);
});

test('the flow initiator decides, not the direction of the alerted packet', () => {
	const policy = policyFor();

	// Response sent by a local server to an external host that opened the connection
	const data = policy.evaluate(event({ src_ip: '10.0.0.13', dest_ip: '8.8.8.8', flow: { src_ip: '8.8.8.8' } }));
	assert.equal(data.srcIp, '8.8.8.8');
	assert.deepEqual(data.evidence.flow, { src_ip: '8.8.8.8' });

	assert.equal(policy.evaluate(event({ flow: { src_ip: '::ffff:8.8.8.8' } })).srcIp, '8.8.8.8');
});

test('alerts between two local or two external hosts are skipped', () => {
	const policy = policyFor();
	assert.equal(policy.evaluate(event({ src_ip: '10.0.0.5' })), null);
	assert.equal(policy.evaluate(event({ dest_ip: '9.9.9.9' })), null);
	assert.equal(policy.evaluate(event({ src_ip: '2a01:11bf:4404:900a::31' })), null);
	assert.equal(policy.evaluate(event({ dest_ip: '2a01:11bf:4404:900a:0:0:0:31' })).srcIp, '8.8.8.8');
});

test('special-purpose and server IPs are never reported', () => {
	const policy = policyFor({}, { getServerIPs: () => ['2001:4860:4860::8888'] });
	assert.equal(policy.evaluate(event({ src_ip: '192.168.1.1' })), null);
	assert.equal(policy.evaluate(event({ src_ip: '2001:4860:4860:0:0:0:0:8888' })), null);
	assert.equal(policy.canReportIP('2001:4860:4860::8888'), false);
	assert.equal(policy.canReportIP('8.8.8.8'), true);
	assert.equal(policy.canReportIP('invalid'), false);
});

test('a public server IP outside HOME_NET counts as local', () => {
	const policy = policyFor({}, { getServerIPs: () => ['1.2.3.4'] });
	assert.equal(policy.evaluate(event({ dest_ip: '1.2.3.4' })).srcIp, '8.8.8.8');
	assert.equal(policy.evaluate(event({ src_ip: '1.2.3.4', dest_ip: '8.8.8.8' })), null);
});

test('IPv4-mapped addresses are normalized', () => {
	assert.equal(policyFor().evaluate(event({ src_ip: '::ffff:8.8.8.8' })).srcIp, '8.8.8.8');
});

test('whitelisted IPs and ignored signatures are skipped', () => {
	assert.equal(policyFor({}, { isWhitelisted: ip => ip === '8.8.8.8' }).evaluate(event()), null);
	assert.equal(policyFor({}, { isIgnored: id => id === 100 }).evaluate(event()), null);
});

test('severity and verdict filters are applied', () => {
	const policy = policyFor();
	assert.equal(policy.evaluate(event({ alert: { signature_id: 100, severity: 3 } })), null);
	assert.ok(policy.evaluate(event({ alert: { signature_id: 100, severity: 2 } })));
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
	const data = policy.evaluate(event({ http: { http_request_body: 'pwd=secret' }, payload: 'AAAA', flow: { src_ip: '8.8.8.8', bytes_toserver: 100 } }));

	assert.equal(JSON.stringify(data.evidence).includes('secret'), false);
	assert.equal(data.evidence.payload, undefined);
	assert.deepEqual(data.evidence.flow, { src_ip: '8.8.8.8' });
	assert.deepEqual(policy.evaluate(data.evidence), data);
});

test('skip reasons are reported only when requested', () => {
	const reasons = [];
	policyFor().evaluate(event({ src_ip: '10.0.0.13', dest_ip: '8.8.8.8' }), reason => reasons.push(reason));
	assert.match(reasons[0], /Connection to 8\.8\.8\.8 was opened from the local network/);
});

test('isHomeNet is required', () => {
	assert.throws(() => createPolicy(CONFIG, {}), /isHomeNet/);
});
