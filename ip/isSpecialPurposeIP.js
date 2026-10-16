const ipaddr = require('ipaddr.js');
const normalizeIP = require('./normalizeIP.js');

const LOCAL_RANGES = new Set([
	'unspecified', 'multicast', 'linkLocal', 'loopback', 'reserved', 'benchmarking', 'amt',
	'broadcast', 'carrierGradeNat', 'private', 'as112',
	'uniqueLocal', 'ipv4Mapped', 'rfc6145', '6to4', 'teredo', 'as112v6', 'orchid2', 'droneRemoteIdProtocolEntityTags',
]);

module.exports = ip => {
	const normalized = normalizeIP(ip);
	if (!normalized) return { is: true, range: null };

	const range = ipaddr.parse(normalized).range();
	return { is: LOCAL_RANGES.has(range), range };
};
