const fs = require('node:fs');
const TailFile = require('@logdna/tail-file');
const split2 = require('split2');
const logIpToFile = require('../logIpToFile.js');
const logger = require('../logger.js');
const resolvePath = require('../pathResolver.js');
const { HONEYTRAP_LOG_FILE, SERVER_ID } = require('../../config.js').MAIN;
const { FLAGS, createFlagCollection } = require('../flags.js');

const LOG_FILE = resolvePath(HONEYTRAP_LOG_FILE);
const HEADER_PRIORITY = ['user-agent', 'accept', 'accept-language', 'accept-encoding'];

let lastFlushTime = Date.now();
const attackBuffer = new Map();

const capitalizeHeader = header => header.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');

const parseHttpRequest = (ascii, dpt) => {
	const lines = ascii.replace(/\r\n|\r/g, '\n').trim().split('\n');

	const requestLineRaw = lines.shift()?.trim() || '';
	const protocol = requestLineRaw.match(/HTTP\/[0-9.]+/i)?.[0]?.toUpperCase() || 'HTTP';
	const requestLine = requestLineRaw.replace(/\s*HTTP\/[0-9.]+$/i, '');

	const headers = {};
	const body = [];
	let parsingBody = false;

	for (const line of lines) {
		if (parsingBody) {
			body.push(line);
			continue;
		}

		if (!line.trim()) {
			parsingBody = true;
			continue;
		}

		const [key, ...value] = line.split(':');
		if (value.length && key.toLowerCase() !== 'host') headers[key.trim().toLowerCase()] = value.join(':').trim();
	}

	const formattedHeaders = HEADER_PRIORITY
		.filter(h => headers[h])
		.map(h => `${capitalizeHeader(h)}: ${headers[h]}`)
		.join('\n');

	let output = `${protocol} request on ${dpt}\n\n${requestLine}`;
	if (formattedHeaders) output += `\n${formattedHeaders}`;

	if (requestLineRaw.startsWith('POST')) {
		const bodyContent = body.join('\n').trim();
		if (bodyContent) output += `\nPOST Data: ${bodyContent}`;
	}

	return output;
};

const getReportDetails = (entry, dpt) => {
	const proto = entry?.attack_connection?.protocol || 'unknown';
	const hex = entry?.attack_connection?.payload?.data_hex || '';
	const ascii = Buffer.from(hex, 'hex').toString('utf8');
	const simplifiedAscii = ascii.replace(/\s+/g, ' ').toLowerCase();
	const payloadLen = entry?.attack_connection?.payload?.length || 0;

	const flags = createFlagCollection();
	let comment;

	switch (true) {
	case payloadLen === 0:
		flags.add(FLAGS.PORT_SCAN);
		comment = `Empty payload on ${dpt}/${proto} (likely service probe)`;
		break;
	case payloadLen > 1000:
		flags.add(FLAGS.BAD_WEB_BOT);
		comment = `Large payload (${payloadLen} bytes) on ${dpt}/${proto}`;
		break;
	case (/HTTP\/(0\.9|1\.0|1\.1|2|3)/i).test(simplifiedAscii):
		flags.add(FLAGS.HTTP, FLAGS.BAD_WEB_BOT);
		comment = parseHttpRequest(ascii, dpt);
		break;
	case (/\bssh\b/).test(simplifiedAscii):
		flags.add(FLAGS.SSH);
		comment = `SSH handshake/banner on ${dpt}/${proto} (${payloadLen} bytes of payload)`;
		break;
	case simplifiedAscii.includes('cookie:'):
		flags.add(FLAGS.HTTP, FLAGS.BAD_WEB_BOT);
		comment = `HTTP header with cookie on ${dpt}/${proto}`;
		break;
	case (/(admin|root|wget|curl|bash|eval|php|bin)/).test(simplifiedAscii):
		flags.add(FLAGS.COMMAND_INJECTION);
		comment = `Suspicious payload on ${dpt}/${proto} (possible command injection)`;
		break;
	default:
		flags.add(FLAGS.PORT_SCAN);
		comment = `Unauthorized traffic on ${dpt}/${proto} (${payloadLen} bytes of payload)`;
		break;
	}

	return { proto, baseComment: comment, categories: flags.toString(), timestamp: entry?.['@timestamp'] };
};

const flushBuffer = async reportIp => {
	if (!attackBuffer.size) return;

	for (const [srcIp, ports] of attackBuffer.entries()) {
		const sortedPorts = Array.from(ports.entries())
			.sort(([, a], [, b]) => b.count - a.count)
			.slice(0, 6);

		const proto = sortedPorts[0][1].proto || 'tcp';
		const timestamp = sortedPorts[0][1].timestamp;
		const baseComment = sortedPorts[0][1].baseComment;
		const categories = sortedPorts[0][1].categories;

		const portSummary = sortedPorts.map(([port, data]) => `${port} [${data.count}]`).join(', ');
		const comment = `Honeypot ${SERVER_ID ? `[${SERVER_ID}]` : 'hit'}: ${baseComment.replace(/ on \d+\/\w+/, '')}; ${portSummary} ${proto.toUpperCase()}`;

		await reportIp('HONEYTRAP', { srcIp, dpt: sortedPorts[0][0], proto, timestamp }, categories, comment);
		await logIpToFile(srcIp, { honeypot: 'HONEYTRAP', comment });
	}

	logger.success(`HONEYTRAP -> Flushed ${attackBuffer.size} IPs`);
	attackBuffer.clear();
};

module.exports = reportIp => {
	if (!fs.existsSync(LOG_FILE)) return logger.error(`HONEYTRAP -> Log file not found: ${LOG_FILE}`, { ping: true });

	const tail = new TailFile(LOG_FILE);
	tail
		.on('tail_error', err => logger.error(err))
		.start()
		.catch(err => logger.error(err));

	tail
		.pipe(split2())
		.on('data', async line => {
			if (!line.length) return;

			let entry;
			try {
				entry = JSON.parse(line);
			} catch (err) {
				return logger.error(`HONEYTRAP -> JSON parse error: ${err.message}\nFaulty line: ${JSON.stringify(line)}`);
			}

			try {
				const srcIp = entry?.attack_connection?.remote_ip;
				const dpt = entry?.attack_connection?.local_port;
				if (!srcIp || !dpt) return;

				let ipData = attackBuffer.get(srcIp);
				if (!ipData) {
					ipData = new Map();
					attackBuffer.set(srcIp, ipData);
				}

				const { proto, timestamp, categories, baseComment } = getReportDetails(entry, dpt);
				let portData = ipData.get(dpt);
				if (portData) {
					portData.count++;
				} else {
					portData = { count: 1, proto, timestamp, categories, baseComment };
					ipData.set(dpt, portData);
				}

				logger.info(`HONEYTRAP -> ${srcIp} hit ${dpt} | x${portData.count}`);
			} catch (err) {
				logger.error(err);
			}
		});

	// Clean buffer
	const cleanupInterval = setInterval(async () => {
		if (Date.now() >= lastFlushTime + 5 * 60 * 1000) {
			await flushBuffer(reportIp);
			lastFlushTime = Date.now();
		}
	}, 60 * 1000);

	logger.success('🛡️ HONEYTRAP » Watcher initialized');
	return {
		tail,
		flush: () => flushBuffer(reportIp),
		cleanup: () => {
			clearInterval(cleanupInterval);
			attackBuffer.clear();
		},
	};
};
