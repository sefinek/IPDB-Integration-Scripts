const { FLAGS, createFlagCollection } = require('../flags.js');
const logIpToFile = require('../logIpToFile.js');
const tailFile = require('../services/tailFile.js');
const logger = require('../logger.js');
const resolvePath = require('../pathResolver.js');
const { DIONAEA_LOG_FILE, SERVER_ID } = require('../../config.js').MAIN;

const LOG_FILE = resolvePath(DIONAEA_LOG_FILE);

const getReportDetails = (entry, dpt) => {
	const proto = entry?.connection?.protocol || 'unknown';
	const timestamp = entry?.timestamp || new Date().toISOString();

	const flags = createFlagCollection();
	let comment;

	switch (proto) {
	case 'mssqld': {
		const username = entry?.credentials?.username?.[0];
		const password = entry?.credentials?.password?.[0];
		if (username && !password) {
			flags.add(FLAGS.BRUTE_FORCE);
			comment = `MSSQL traffic (on ${dpt}) with username ${username} and empty password`;
		} else if (username && password) {
			flags.add(FLAGS.BRUTE_FORCE);
			comment = `MSSQL traffic (on ${dpt}) with credentials ${username}:${password}`;
		} else {
			flags.add(FLAGS.PORT_SCAN);
			comment = `MSSQL traffic (on ${dpt}) without login credentials`;
		}
		break;
	}
	case 'httpd':
		flags.add(FLAGS.HTTP, FLAGS.BAD_WEB_BOT);
		comment = `Incoming HTTP traffic on port ${dpt}`;
		break;
	case 'ftp':
		flags.add(FLAGS.FTP, FLAGS.BRUTE_FORCE);
		comment = `FTP brute-force or probing on port ${dpt}`;
		break;
	case 'smbd':
		flags.add(FLAGS.SMB);
		comment = `SMB traffic on port ${dpt}`;
		break;
	case 'mysql':
		flags.add(FLAGS.BRUTE_FORCE);
		comment = `MySQL brute-force or probing on port ${dpt}`;
		break;
	case 'tftp':
		flags.add(FLAGS.EXPLOITED_HOST);
		comment = `TFTP protocol traffic on ${dpt}`;
		break;
	case 'upnp':
	case 'mqtt':
		flags.add(FLAGS.IOT_TARGETED);
		comment = `Unauthorized ${proto.toUpperCase()} traffic on ${dpt}`;
		break;
	default:
		flags.add(FLAGS.PORT_SCAN);
		comment = `Unauthorized traffic on ${dpt}/${proto}`;
	}

	return {
		proto: proto.toUpperCase(),
		comment: `Honeypot ${SERVER_ID ? `[${SERVER_ID}]` : 'hit'}: ${comment}`,
		categories: flags.toString(),
		timestamp,
	};
};

module.exports = reportIp => {
	tailFile(LOG_FILE, async line => {
		if (!line.length) return;

		let entry;
		try {
			entry = JSON.parse(line);
		} catch (err) {
			return logger.error(`DIONAEA -> JSON parse error: ${err.message}\nFaulty line: ${JSON.stringify(line)}`);
		}

		try {
			const srcIp = entry?.src_ip;
			const dpt = entry?.dst_port;
			if (!srcIp || !dpt) return;

			const { proto, timestamp, categories, comment } = getReportDetails(entry, dpt);
			await reportIp('DIONAEA', { srcIp, dpt, proto, timestamp }, categories, comment);

			await logIpToFile(srcIp, { honeypot: 'DIONAEA', comment });
		} catch (err) {
			logger.error(err);
		}
	}, { label: 'DIONAEA' }).catch(err => logger.error(err));

	logger.success('🛡️ DIONAEA » Watcher initialized');
};
