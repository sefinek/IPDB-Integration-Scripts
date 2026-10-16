const normalizeIP = require('../normalizeIP.js');
const isSpecialPurposeIP = require('../isSpecialPurposeIP.js');
const { FLAGS, createFlagCollection } = require('../flags.js');

const MAX_CLOCK_SKEW = 5 * 60 * 1000;

// Suricata classtypes (alert.category) mapped to abuse flags. Everything else is reported as HACKING.
const CATEGORY_FLAGS = {
	'Detection of a Network Scan': [FLAGS.PORT_SCAN],
	'Attempted Information Leak': [FLAGS.PORT_SCAN],
	'Web Application Attack': [FLAGS.WEB_APP_ATTACK],
	'Attempted Denial of Service': [FLAGS.DDOS_ATTACK],
	'Denial of Service': [FLAGS.DDOS_ATTACK],
};

const toCategories = category => createFlagCollection().add(...(CATEGORY_FLAGS[category] ?? [FLAGS.HACKING])).toString();

const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;

module.exports = (config, { isHomeNet, getServerIPs = () => [], isWhitelisted = () => false, getIgnoredReason = () => null, now = Date.now }) => {
	if (typeof isHomeNet !== 'function') throw new Error('isHomeNet must be a function');

	const minSeverity = config.MIN_ALERT_SEVERITY;
	const verdicts = config.ALLOWED_VERDICT_ACTIONS ?? ['alert', 'drop'];

	// Expects an already normalized address
	const isLocal = ip => isSpecialPurposeIP(ip).is || isHomeNet(ip) || getServerIPs().includes(ip);

	const canReportIP = value => {
		const ip = normalizeIP(value);
		return Boolean(ip) && !isLocal(ip) && !isWhitelisted(ip);
	};

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
			...(initiator && { flow: { src_ip: initiator } }),
			...(verdict && { verdict: { action: verdict } }),
		};

		return {
			srcIp: offender,
			dpt: event.dest_port ?? 'N/A',
			proto: event.proto ?? 'N/A',
			id,
			severity,
			signature,
			timestamp,
			categories: toCategories(category),
			evidence,
		};
	};

	return Object.freeze({ evaluate, canReportIP });
};
