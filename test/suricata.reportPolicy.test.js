const { setup } = require('./helpers.js');
setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHomeNet } = require('../integrations/suricata/homeNet.js');
const createPolicy = require('../integrations/suricata/reportPolicy.js');
const { FLAGS, createFlagCollection } = require('../reporting/flags.js');

// Category IDs differ between AbuseIPDB and SniffCat, so expectations are built for the current integration
const ids = (...flags) => createFlagCollection().add(...flags).toString();

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
	assert.equal(data.categories, ids(FLAGS.HACKING, FLAGS.SSH));
	assert.equal(data.dpt, 22);
	assert.equal(data.proto, 'TCP');
	assert.equal(data.signature, 'Test alert');
});

const categoriesOf = (category, signature = 'Test alert', changes = { dest_port: 8080 }) => policyFor().evaluate(event({ alert: { signature_id: 100, severity: 1, signature, category }, ...changes })).categories;

test('categories are based on the alert classification', () => {
	assert.equal(categoriesOf('Detection of a Network Scan'), ids(FLAGS.PORT_SCAN));
	assert.equal(categoriesOf('Attempted Information Leak'), ids(FLAGS.PORT_SCAN));
	assert.equal(categoriesOf('Web Application Attack'), ids(FLAGS.WEB_APP_ATTACK));
	assert.equal(categoriesOf('Attempted Denial of Service'), ids(FLAGS.DDOS_ATTACK));
	assert.equal(categoriesOf('Unknown classtype'), ids(FLAGS.HACKING));
	assert.equal(categoriesOf(undefined), ids(FLAGS.HACKING));
});

test('the ruleset category in the signature is used when the classification is not mapped', () => {
	assert.equal(categoriesOf('Misc activity', 'ET SCAN Suspicious inbound to mySQL port 3306'), ids(FLAGS.PORT_SCAN));
	assert.equal(categoriesOf('Misc Attack', 'ET DOS Possible NTP DDoS Inbound Frequent Un-Authed MON_LIST Requests'), ids(FLAGS.DDOS_ATTACK));
	assert.equal(categoriesOf('Attempted User Privilege Gain', 'ET WEB_SPECIFIC_APPS Something'), ids(FLAGS.WEB_APP_ATTACK));
	assert.equal(categoriesOf('Misc Attack', 'ET COMPROMISED Known Compromised or Hostile Host Traffic group 1'), ids(FLAGS.EXPLOITED_HOST));
	assert.equal(categoriesOf('Misc Attack', 'ET EXPLOIT Something'), ids(FLAGS.HACKING));
	assert.equal(categoriesOf('Detection of a Network Scan', 'ET DOS Something'), ids(FLAGS.PORT_SCAN));
});

test('attack techniques in the signature add detail flags', () => {
	assert.equal(categoriesOf('Web Application Attack', 'ET WEB_SERVER Possible SQL Injection Attempt UNION SELECT'), ids(FLAGS.WEB_APP_ATTACK, FLAGS.SQL_INJECTION));
	assert.equal(categoriesOf('Web Application Attack', 'ET WEB_SERVER Directory Traversal Attempt'), ids(FLAGS.WEB_APP_ATTACK, FLAGS.PATH_TRAVERSAL));
	assert.equal(categoriesOf('Attempted Administrator Privilege Gain', 'ET EXPLOIT Netgear Remote Code Execution'), ids(FLAGS.HACKING, FLAGS.COMMAND_INJECTION));
	assert.equal(categoriesOf('Misc Attack', 'ET MALWARE Possible Linux.Mirai Login Attempt'), ids(FLAGS.HACKING, FLAGS.IOT_TARGETED));
});

test('the attacked service comes from app_proto, then from the local port, never from the signature text', () => {
	assert.equal(categoriesOf('Attempted Information Leak', 'ET SCAN Potential SSH Scan', { dest_port: 22 }), ids(FLAGS.PORT_SCAN, FLAGS.SSH));
	assert.equal(categoriesOf('Misc Attack', 'Test alert', { dest_port: 2222, app_proto: 'ssh' }), ids(FLAGS.HACKING, FLAGS.SSH));
	assert.equal(categoriesOf('Misc Attack', 'Test alert', { dest_port: 13389, app_proto: 'rdp' }), ids(FLAGS.HACKING, FLAGS.RDP));
	assert.equal(categoriesOf('Misc Attack', 'Test alert', { dest_port: 22, app_proto: 'http' }), ids(FLAGS.HACKING));
	assert.equal(categoriesOf('Misc Attack', 'Test alert', { dest_port: 23, app_proto: 'failed' }), ids(FLAGS.HACKING, FLAGS.TELNET));
	assert.equal(categoriesOf('Misc Attack', 'ET EXPLOIT REDIS Attempted SSH Key Upload', { dest_port: 6379 }), ids(FLAGS.HACKING, FLAGS.REDIS));
	assert.equal(categoriesOf('Web Application Attack', 'ET WEB_SPECIFIC_APPS Nagios XI Web SSH Terminal XSS', { dest_port: 443, app_proto: 'tls' }), ids(FLAGS.WEB_APP_ATTACK));
});

test('FTP is added only to brute-force attempts', () => {
	assert.equal(categoriesOf('Misc Attack', 'GPL FTP CWD ~ attempt', { dest_port: 21, app_proto: 'ftp' }), ids(FLAGS.HACKING));
	assert.equal(categoriesOf('Attempted Information Leak', 'ET SCAN Multiple FTP Root Login Attempts - Possible Brute Force Attempt', { dest_port: 21, app_proto: 'ftp' }), ids(FLAGS.PORT_SCAN, FLAGS.BRUTE_FORCE, FLAGS.FTP));
});

test('an alert on a reply from the local server uses the local port', () => {
	const data = policyFor().evaluate(event({
		src_ip: '10.0.0.13', src_port: 22, dest_ip: '8.8.8.8', dest_port: 51234,
		flow: { src_ip: '8.8.8.8' },
		alert: { signature_id: 2100498, severity: 2, signature: 'GPL ATTACK_RESPONSE id check returned root', category: 'Potentially Bad Traffic' },
	}));
	assert.equal(data.srcIp, '8.8.8.8');
	assert.equal(data.dpt, 22);
	assert.equal(data.categories, ids(FLAGS.HACKING, FLAGS.SSH));
});

test('app_proto is kept in the evidence, so re-evaluation gives the same categories', () => {
	const policy = policyFor();
	const first = policy.evaluate(event({ dest_port: 2222, app_proto: 'ssh' }));
	assert.equal(first.evidence.app_proto, 'ssh');
	assert.equal(policy.evaluate(first.evidence).categories, first.categories);
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
	const reasons = [];
	assert.equal(policyFor({}, { getIgnoredReason: id => (id === 100 ? 'Discord' : null) }).evaluate(event(), reason => reasons.push(reason)), null);
	assert.equal(reasons[0], 'Signature 100 is ignored (Discord)');
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
