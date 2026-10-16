const normalizeIP = require('../normalizeIP.js');
const isSpecialPurposeIP = require('../isSpecialPurposeIP.js');
const { FLAGS, createFlagCollection } = require('../flags.js');

const OFFENDERS = ['src', 'dest'];
const MAX_CLOCK_SKEW = 5 * 60 * 1000;

const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;
const isFlag = value => Object.hasOwn(FLAGS, value);

// Rules use flags instead of category IDs, so the same config works for every supported service (AbuseIPDB, SniffCat)
const parseRules = (reportRules = []) => {
	if (!Array.isArray(reportRules)) throw new Error('REPORT_RULES must be an array');

	const rules = new Map();
	for (const rule of reportRules) {
		const { signatureId, offender, flags, review = false } = rule ?? {};
		if (!isPositiveInteger(signatureId)) throw new Error(`REPORT_RULES: invalid signatureId ${signatureId}`);
		if (rules.has(signatureId)) throw new Error(`REPORT_RULES: duplicate signatureId ${signatureId}`);
		if (!OFFENDERS.includes(offender)) throw new Error(`REPORT_RULES: offender for ${signatureId} must be 'src' or 'dest'`);
		if (!Array.isArray(flags) || !flags.length || !flags.every(isFlag)) throw new Error(`REPORT_RULES: flags for ${signatureId} must be a non-empty array of FLAGS from scripts/flags.js`);
		if (typeof review !== 'boolean') throw new Error(`REPORT_RULES: review for ${signatureId} must be a boolean`);

		rules.set(signatureId, { offender, review, categories: createFlagCollection().add(...flags).toString() });
	}

	return rules;
};

module.exports = (config, { isHomeNet, getServerIPs = () => [], isWhitelisted = () => false, isIgnored = () => false, now = Date.now }) => {
	if (typeof isHomeNet !== 'function') throw new Error('isHomeNet must be a function');

	const rules = parseRules(config.REPORT_RULES);
	const minSeverity = config.MIN_ALERT_SEVERITY;
	const verdicts = config.ALLOWED_VERDICT_ACTIONS ?? ['alert', 'drop'];

	// Expects an already normalized address
	const isLocal = ip => isSpecialPurposeIP(ip).is || isHomeNet(ip) || getServerIPs().includes(ip);

	const canReportIP = value => {
		const ip = normalizeIP(value);
		return Boolean(ip) && !isLocal(ip) && !isWhitelisted(ip);
	};

	// Returns report data or null. onSkip receives the reason why an alert was not eligible.
	const evaluate = (event, onSkip) => {
		if (event?.event_type !== 'alert' || !event.alert) return null;

		const skip = reason => {
			onSkip?.(reason);
			return null;
		};

		const { signature_id: id, severity, signature = 'Unknown Signature' } = event.alert;
		if (!isPositiveInteger(id) || !Number.isInteger(severity) || severity < 1) return skip(`Invalid alert metadata: SIGNATURE=${id} SEVERITY=${severity}`);
		if (isIgnored(id)) return skip(`Signature ${id} is ignored`);
		if (severity > minSeverity) return skip(`${signature}: SIGNATURE=${id} SEVERITY=${severity} is below the threshold`);

		const verdict = event.verdict?.action;
		if (verdict && !verdicts.includes(verdict)) return skip(`Verdict action '${verdict}' is not in ALLOWED_VERDICT_ACTIONS`);

		const rule = rules.get(id);
		if (!rule) return skip(`Signature ${id} has no entry in REPORT_RULES`);

		const src = normalizeIP(event.src_ip);
		const dest = normalizeIP(event.dest_ip);
		if (!src || !dest) return skip(`Invalid addresses: SRC=${event.src_ip} DEST=${event.dest_ip}`);

		const [offender, peer] = rule.offender === 'src' ? [src, dest] : [dest, src];
		if (isLocal(offender)) return skip(`Offender ${offender} is local, signature ${id}`);
		if (!isLocal(peer)) return skip(`Peer ${peer} is not in HOME_NET, signature ${id}`);
		if (isWhitelisted(offender)) return skip(`Ignoring whitelisted IP address: ${offender}`);

		// Suricata 7+ includes the flow initiator. Without this check, a remote host that only replied to a local connection would be reported.
		const initiator = normalizeIP(event.flow?.src_ip);
		if (rule.offender === 'src' && initiator && initiator !== offender) return skip(`Flow was initiated by ${initiator}, not by ${offender}, signature ${id}`);

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
			alert: { signature_id: id, severity, signature },
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
			categories: rule.categories,
			review: rule.review,
			evidence,
		};
	};

	const ruleCount = { report: 0, review: 0 };
	for (const rule of rules.values()) ruleCount[rule.review ? 'review' : 'report']++;

	return Object.freeze({ evaluate, canReportIP, ruleCount: Object.freeze(ruleCount) });
};
