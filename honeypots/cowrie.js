const { FLAGS, createFlagCollection } = require('../flags.js');
const { MAX_COMMENT_LENGTH, joinWithinLimit } = require('../comment.js');
const logIpToFile = require('../logIpToFile.js');
const tailFile = require('../services/tailFile.js');
const logger = require('../logger.js');
const resolvePath = require('../pathResolver.js');
const { COWRIE_LOG_FILE, SERVER_ID } = require('../../config.js').MAIN;

const LOG_FILE = resolvePath(COWRIE_LOG_FILE);
const REPORT_DELAY = SERVER_ID === 'development' ? 30 * 1000 : 10 * 60 * 1000;

// Leaves room for footers appended by reportIp (e.g. "Reported by: <repo url>"); reportIp still enforces the hard limit
const COMMENT_BUDGET = MAX_COMMENT_LENGTH - 100;
const MIN_CREDS_LENGTH = 64;
const ipBuffers = new Map();

const extractSessionData = sessions => {
	const commands = [];
	const flags = createFlagCollection();

	const credsSet = new Set();
	const fingerprints = new Set();
	const uploads = new Set();
	const tunnels = new Set();

	let dpt = null, proto = null, sshVersion = null, timestamp = null;
	const downloadUrls = new Set();

	for (const s of sessions) {
		dpt ??= s.dpt;
		proto ??= s.proto;
		sshVersion ??= s.sshVersion;
		timestamp ??= s.timestamp;

		s.credentials?.forEach((_, cred) => credsSet.add(cred));
		commands.push(...s.commands);

		if (s.fingerprint) fingerprints.add(s.fingerprint);
		if (s.uploads) s.uploads.forEach(f => uploads.add(f));
		if (s.tunnels) s.tunnels.forEach(t => tunnels.add(t));
		if (s.download?.url) {
			flags.add(FLAGS.WEB_APP_ATTACK);
			downloadUrls.add(s.download.url);
		}
	}

	const creds = [...credsSet];
	const loginAttempts = creds.length;
	const cmdCount = commands.length;

	if (loginAttempts >= 2) flags.add(FLAGS.BRUTE_FORCE);
	if (proto === 'ssh') flags.add(FLAGS.SSH);
	if (proto === 'telnet') flags.add(FLAGS.TELNET);
	if (cmdCount) flags.add(FLAGS.EMAIL);
	if (!loginAttempts && !cmdCount) flags.add(FLAGS.PORT_SCAN);

	return {
		dpt, proto, sshVersion, timestamp, creds, commands,
		categories: flags.toString(),
		downloadUrls: [...downloadUrls],
		fingerprints: [...fingerprints],
		uploads: [...uploads],
		tunnels: [...tunnels],
	};
};

const buildComment = ({ serverId, dpt, proto, creds, commands, sshVersion, downloadUrls, fingerprints, uploads, tunnels }, full = false) => {
	const loginAttempts = creds.length;
	const cmdCount = commands.length;

	const header = `Honeypot ${serverId ? `[${serverId}]` : 'hit'}: ${loginAttempts ? 'Brute-force attack' : 'Unauthorized connection attempt'} detected on ${dpt}/${proto.toUpperCase()}`;
	const details = [];
	if (loginAttempts) details.push(`• Number of login attempts: ${loginAttempts}`);
	if (cmdCount) details.push(`• ${cmdCount} command(s) were executed during the session`);
	if (sshVersion) details.push(`• Client: ${sshVersion}`);
	if (downloadUrls.length) details.push(`• Suspicious file URLs: ${downloadUrls.join(', ')}`);
	if (fingerprints.length) details.push(`• SSH key fingerprints: ${fingerprints.join(', ')}`);
	if (uploads.length) details.push(`• Uploaded files: ${uploads.join(', ')}`);
	if (tunnels.length) details.push(`• TCP tunnels: ${tunnels.join(', ')}`);

	if (!loginAttempts) return [header, ...details].join('\n');

	const label = loginAttempts === 1 ? '• Credential used: ' : '• Credentials: ';
	const credsBudget = COMMENT_BUDGET - [header, ...details].join('\n').length - label.length - 1;
	const credsText = full ? creds.join(', ') : joinWithinLimit(creds, Math.max(credsBudget, MIN_CREDS_LENGTH));

	return [header, `${label}${credsText}`, ...details].join('\n');
};

const flushBuffer = async (srcIp, reportIp) => {
	const buffer = ipBuffers.get(srcIp);
	if (!buffer) return;

	clearTimeout(buffer.timer);
	ipBuffers.delete(srcIp);

	const sessions = buffer.sessions || [];
	if (!sessions.length) return;

	const {
		dpt, proto, sshVersion, timestamp, creds, commands,
		categories, downloadUrls, fingerprints, uploads, tunnels,
	} = extractSessionData(sessions);

	if (!srcIp || !dpt || !proto) {
		return logger.warn(`COWRIE -> Incomplete data for ${srcIp}, discarded`);
	}

	const shortComment = buildComment({ serverId: SERVER_ID, dpt, proto, creds, commands, sshVersion, downloadUrls, fingerprints, uploads, tunnels }, false);
	const [, ...restLines] = shortComment.split('\n');
	const rest = restLines.length ? `\n${restLines.join('\n')}` : '';

	await reportIp('COWRIE', { srcIp, dpt, proto, timestamp }, categories, shortComment);
	if (restLines.length) await logger.info(rest);
	await logger.webhook(`### Cowrie: ${srcIp} on ${dpt}/${proto}${rest}`);

	logIpToFile(srcIp, { honeypot: 'COWRIE', comment: buildComment({ serverId: SERVER_ID, dpt, proto, creds, commands, sshVersion, downloadUrls, fingerprints, uploads, tunnels }, true) });
};

const processCowrieLogLine = async (entry, reportIp) => {
	const ip = entry?.src_ip;
	const sessionId = entry?.session;
	const { eventid } = entry;
	if (!ip || !eventid || !sessionId) return logger.warn('COWRIE -> Skipped: missing src_ip, eventid or sessionId');

	let buffer = ipBuffers.get(ip);
	if (!buffer) {
		buffer = {
			sessions: [],
			timer: setTimeout(() => flushBuffer(ip, reportIp), REPORT_DELAY),
			lastSeen: Date.now(),
		};
		ipBuffers.set(ip, buffer);
	} else {
		buffer.lastSeen = Date.now();
	}

	let session = buffer.sessions.find(s => s.sessionId === sessionId);
	if (!session && eventid !== 'cowrie.session.closed') {
		session = {
			sessionId,
			srcIp: ip,
			dpt: null,
			proto: null,
			timestamp: null,
			credentials: new Map(),
			commands: [],
			sshVersion: null,
			download: null,
			fingerprint: null,
			uploads: [],
			tunnels: [],
		};
		buffer.sessions.push(session);
	}

	switch (eventid) {
	case 'cowrie.session.connect':
		if (session) {
			session.dpt = entry.dst_port;
			session.proto = entry.protocol;
			session.timestamp = entry.timestamp;
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: Connect`);
		}
		break;

	case 'cowrie.login.success':
	case 'cowrie.login.failed':
		if (session && (entry.username || entry.password)) {
			session.credentials.set(`${entry.username}:${entry.password}`, true);
			const status = eventid === 'cowrie.login.success' ? 'Connected' : 'Failed login';
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: ${status} » ${entry.username}:${entry.password}`);
		}
		break;

	case 'cowrie.client.version':
		if (session) {
			session.sshVersion = entry.version;
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: SSH version » ${entry.version}`);
		}
		break;

	case 'cowrie.command.input':
		if (session && entry.input) {
			session.commands.push(entry.input);
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: $ ${entry.input}`);
		}
		break;

	case 'cowrie.session.file_download':
		if (session && entry.url) {
			session.commands.push(`[download] ${entry.url}`);
			session.download = { url: entry.url, outfile: entry.outfile };
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: File download » ${entry.url}`);
		}
		break;

	case 'cowrie.client.fingerprint':
		if (session && entry.fingerprint) {
			session.fingerprint = entry.fingerprint;
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: SSH key fingerprint » ${entry.fingerprint}`);
		}
		break;

	case 'cowrie.session.file_upload':
		if (session && entry.filename) {
			session.uploads.push(entry.filename);
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: File upload » ${entry.filename}`);
		}
		break;

	case 'cowrie.direct-tcpip.request':
		if (session && entry.dst_ip && entry.dst_port) {
			const tunnel = `${entry.dst_ip}:${entry.dst_port}`;
			session.tunnels.push(tunnel);
			logger.info(`COWRIE -> ${ip}/${session.proto}/${session.dpt}: TCP tunnel request » ${tunnel}`);
		}
		break;

	case 'cowrie.session.closed':
		logger.info(`COWRIE -> ${ip}/${session?.proto ?? 'unknown'}/${session?.dpt ?? '-'}: Session ${sessionId} closed`);
		break;
	}
};

module.exports = reportIp => {
	tailFile(LOG_FILE, async line => {
		if (!line.length) return;

		let entry;
		try {
			entry = JSON.parse(line);
		} catch (err) {
			return logger.error(`COWRIE -> JSON parse error: ${err.message}\nFaulty line: ${JSON.stringify(line)}`);
		}

		try {
			await processCowrieLogLine(entry, reportIp);
		} catch (err) {
			logger.error(err);
		}
	}, { label: 'COWRIE' }).catch(err => logger.error(err));

	// Clean buffer
	const cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [ip, buffer] of ipBuffers.entries()) {
			if (now - buffer.lastSeen > 30 * 60 * 1000) {
				clearTimeout(buffer.timer);
				ipBuffers.delete(ip);
				logger.warn(`COWRIE -> Cleaned up stale session buffer for ${ip}`);
			}
		}
	}, 15 * 60 * 1000);

	logger.success('🛡️ COWRIE » Watcher initialized');
	return {
		flush: async () => {
			for (const ip of ipBuffers.keys()) {
				await flushBuffer(ip, reportIp);
			}
		},
		cleanup: () => {
			clearInterval(cleanupInterval);
			for (const buffer of ipBuffers.values()) {
				clearTimeout(buffer.timer);
			}
			ipBuffers.clear();
		},
	};
};
