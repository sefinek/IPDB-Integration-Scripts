const ipaddr = require('ipaddr.js');

const LOCAL_RANGES = new Set([
	'unspecified', 'multicast', 'linkLocal', 'loopback', 'reserved', 'benchmarking', 'amt',
	'broadcast', 'carrierGradeNat', 'private', 'as112',
	'uniqueLocal', 'ipv4Mapped', 'rfc6145', '6to4', 'teredo', 'as112v6', 'orchid2', 'droneRemoteIdProtocolEntityTags',
]);

module.exports = ip => {
	try {
		const range = ipaddr.parse(ip).range();
		return LOCAL_RANGES.has(range);
	} catch {
		return false;
	}
};