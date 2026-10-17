const normalizeIP = require('../../ip/normalizeIP.js');
const isSpecialPurposeIP = require('../../ip/isSpecialPurposeIP.js');
const { FLAGS, createFlagCollection } = require('../../reporting/flags.js');

const MAX_CLOCK_SKEW = 5 * 60 * 1000;

// The main category comes from the classtype (alert.category), then from the ruleset category in the
// signature name ("ET SCAN ...", "ET DOS ..."), and falls back to HACKING.
const CATEGORY_FLAGS = {
	'Detection of a Network Scan': [FLAGS.PORT_SCAN],
	'Attempted Information Leak': [FLAGS.PORT_SCAN],
	'Web Application Attack': [FLAGS.WEB_APP_ATTACK],
	'Attempted Denial of Service': [FLAGS.DDOS_ATTACK],
	'Denial of Service': [FLAGS.DDOS_ATTACK],
};

const RULESET_CATEGORY_FLAGS = {
	SCAN: [FLAGS.PORT_SCAN],
	DOS: [FLAGS.DDOS_ATTACK],
	WEB_SERVER: [FLAGS.WEB_APP_ATTACK],
	WEB_SPECIFIC_APPS: [FLAGS.WEB_APP_ATTACK],
	USER_AGENTS: [FLAGS.BAD_WEB_BOT],
	COMPROMISED: [FLAGS.EXPLOITED_HOST],
};

// Attack techniques named in the signature. They only add detail to the main category.
const TECHNIQUE_FLAGS = [
	[/SQL Injection|\bSQLi\b/i, FLAGS.SQL_INJECTION],
	[/(?:Directory|Path) Traversal/i, FLAGS.PATH_TRAVERSAL],
	[/Command Injection|Remote Code Execution|\bRCE\b/i, FLAGS.COMMAND_INJECTION],
	[/Brute ?Force|Password Guess/i, FLAGS.BRUTE_FORCE],
	[/\b(?:Mirai|Mozi|Gafgyt|Hajime)\b/i, FLAGS.IOT_TARGETED],
];

// The attacked service is taken from the protocol Suricata detected (app_proto), or from the local port when the
// protocol is unknown. Signature text is not used, because many rules name a service they do not target
// (e.g. "Redis Attempted SSH Key Upload", "Nagios XI Web SSH Terminal XSS").
const SERVICE_FLAGS = { ssh: FLAGS.SSH, telnet: FLAGS.TELNET, smb: FLAGS.SMB, rdp: FLAGS.RDP, redis: FLAGS.REDIS, mongodb: FLAGS.MONGODB, ftp: FLAGS.FTP };
const SERVICE_PORTS = { 21: 'ftp', 22: 'ssh', 2222: 'ssh', 23: 'telnet', 2323: 'telnet', 139: 'smb', 445: 'smb', 3389: 'rdp', 6379: 'redis', 27017: 'mongodb' };

const RULESET_CATEGORY = /^(?:ET|ETPRO|GPL)\s+([A-Z_]+)\b/;

const toCategories = ({ category, signature, appProto, localPort }) => {
	const rulesetCategory = signature.match(RULESET_CATEGORY)?.[1];
	const main = CATEGORY_FLAGS[category] ?? RULESET_CATEGORY_FLAGS[rulesetCategory] ?? [FLAGS.HACKING];
	const techniques = TECHNIQUE_FLAGS.filter(([pattern]) => pattern.test(signature)).map(([, flag]) => flag);

	const service = appProto && appProto !== 'failed' ? appProto : SERVICE_PORTS[localPort];
	// AbuseIPDB category 5 is "FTP Brute-Force", so FTP is only added to brute-force attempts
	const serviceFlag = service === 'ftp' && !techniques.includes(FLAGS.BRUTE_FORCE) ? null : SERVICE_FLAGS[service];

	return createFlagCollection().add(...main, ...techniques, ...(serviceFlag ? [serviceFlag] : [])).toString();
};

const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;

module.exports = (config, { isHomeNet, getServerIPs = () => [], isWhitelisted = () => false, getIgnoredReason = () => null, now = Date.now }) => {
	if (typeof isHomeNet !== 'function') throw new Error('isHomeNet must be a function');

	const minSeverity = config.MIN_ALERT_SEVERITY;
	const verdicts = config.ALLOWED_VERDICT_ACTIONS ?? ['alert', 'drop'];

	// Expects an already normalized address
	const isLocal = ip => isSpecialPurposeIP(ip).is || isHomeNet(ip) || getServerIPs().includes(ip);

	/**
	 * Only an external host that opened a connection to a local one is reported.
	 * Hosts contacted from the local network (DNS resolvers, CDNs, P2P peers) are never reported, even if they trigger an alert.
	 * @returns {Object|null} Report data, or null if the alert is not eligible. onSkip receives the reason.
	 */
	const evaluate = (event, onSkip) => {
		if (event?.event_type !== 'alert' || !event.alert) return null;

		const skip = reason => {
			onSkip?.(reason);
			return null;
		};

		const { signature_id: id, severity, signature = 'Unknown Signature', category } = event.alert;
		if (!isPositiveInteger(id) || !Number.isInteger(severity) || severity < 1) return skip(`Invalid alert metadata: SIGNATURE=${id} SEVERITY=${severity}`);
		const ignoredReason = getIgnoredReason(id);
		if (ignoredReason) return skip(`Signature ${id} is ignored (${ignoredReason})`);
		if (severity > minSeverity) return skip(`${signature}: SIGNATURE=${id} SEVERITY=${severity} is below the threshold`);

		const verdict = event.verdict?.action;
		if (verdict && !verdicts.includes(verdict)) return skip(`Verdict action '${verdict}' is not in ALLOWED_VERDICT_ACTIONS`);

		const src = normalizeIP(event.src_ip);
		const dest = normalizeIP(event.dest_ip);
		if (!src || !dest) return skip(`Invalid addresses: SRC=${event.src_ip} DEST=${event.dest_ip}`);

		const srcIsLocal = isLocal(src);
		const destIsLocal = isLocal(dest);
		if (srcIsLocal === destIsLocal) return skip(`${srcIsLocal ? 'Both' : 'Neither'} SRC=${src} and DEST=${dest} ${srcIsLocal ? 'are' : 'is'} local, signature ${id}`);

		const offender = srcIsLocal ? dest : src;

		// Suricata 7+ includes the flow initiator. Older versions only tell the direction of the alerted packet.
		const initiator = normalizeIP(event.flow?.src_ip);
		if ((initiator ?? src) !== offender) return skip(`Connection to ${offender} was opened from the local network, signature ${id}`);
		if (isWhitelisted(offender)) return skip(`Ignoring whitelisted IP address: ${offender}`);

		const timestamp = typeof event.timestamp === 'string' ? Date.parse(event.timestamp) : NaN;
		if (!Number.isFinite(timestamp) || timestamp > now() + MAX_CLOCK_SKEW) return skip(`Invalid alert timestamp: ${event.timestamp}`);

		const appProto = typeof event.app_proto === 'string' ? event.app_proto : undefined;

		// Only the metadata required to re-evaluate the alert later. No payloads or HTTP bodies.
		const evidence = {
			event_type: 'alert',
			timestamp: event.timestamp,
			src_ip: src,
			dest_ip: dest,
			src_port: event.src_port,
			dest_port: event.dest_port,
			proto: event.proto,
			alert: { signature_id: id, severity, signature, ...(category && { category }) },
			...(appProto && { app_proto: appProto }),
			...(initiator && { flow: { src_ip: initiator } }),
			...(verdict && { verdict: { action: verdict } }),
		};

		// The attacked service runs on the local side, which is the source when the alert matched a reply
		const localPort = srcIsLocal ? event.src_port : event.dest_port;

		return {
			srcIp: offender,
			dpt: localPort ?? 'N/A',
			proto: event.proto ?? 'N/A',
			id,
			severity,
			signature,
			timestamp,
			categories: toCategories({ category, signature, appProto, localPort }),
			evidence,
		};
	};

	return Object.freeze({ evaluate });
};
