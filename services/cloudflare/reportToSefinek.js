const FormData = require('form-data');
const logger = require('../../logger.js');
const { readReportedIPs, batchUpdateSefinekAPIInCSV } = require('./csv.js');
const { axiosSefinek } = require('../axios.js');
const { getServerIPs } = require('../ipFetcher.js');

module.exports = async () => {
	const serverIPs = getServerIPs();
	const reportedIPs = (await readReportedIPs() || []).filter(x =>
		['REPORTED', 'READY_FOR_BULK_REPORT', 'RL_BULK_REPORT'].includes(x.status) &&
		!serverIPs.includes(x.ip) &&
		!x.sefinekAPI
	);
	if (!reportedIPs.length) return logger.log('Sefinek API: No data to report');

	const seenIPs = new Set();
	const uniqueLogs = reportedIPs.filter(ip => {
		if (seenIPs.has(ip.ip)) return false;
		seenIPs.add(ip.ip);
		return true;
	});

	if (!uniqueLogs.length) return logger.log(`Sefinek API: No unique IPs to send (reportedIPs = ${reportedIPs.length}; uniqueLogs = ${uniqueLogs.length})`);

	try {
		const payload = uniqueLogs.map(ip => ({
			rayId: ip.rayId,
			ip: ip.ip,
			endpoint: ip.endpoint,
			userAgent: ip.userAgent,
			action: ip.action,
			country: ip.country,
			timestamp: ip.timestamp,
		}));

		const base64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
		const form = new FormData();
		form.append('file', base64, {
			filename: 'reports.dat',
			contentType: 'application/octet-stream',
		});

		const res = await axiosSefinek.post('https://api.sefinek.net/api/v2/cloudflare-waf-abuseipdb', form, { headers: { ...form.getHeaders() } });
		// const res = await axiosSefinek.post('http://127.0.0.1:4010/api/v2/cloudflare-waf-abuseipdb', form, { headers: { ...form.getHeaders() } });
		if (res.data.success) {
			logger.log(`Sefinek API (status: ${res.status}): Successfully sent ${uniqueLogs.length} logs`, 1);
			await batchUpdateSefinekAPIInCSV(uniqueLogs.map(x => x.rayId));
		} else {
			logger.log(`Sefinek API (status: ${res.status}): ${res.data.message || 'Something went wrong'}`, 2);
		}
	} catch (err) {
		if (err.response?.data?.message?.includes('No valid or unique')) return;
		const msg = err.response?.data?.message ?? err.message;
		logger.log(`Sefinek API (status: ${err.response?.status ?? 'unknown'}): Failed to send logs! Message: ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`, 3);
	}
};