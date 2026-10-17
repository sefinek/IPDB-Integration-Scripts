const DEFAULT_STALL_TIMEOUT = 15 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL = 60 * 1000;

/**
 * Warns when Suricata stops receiving traffic, e.g. after a mirror port or capture NIC goes down.
 * Suricata keeps running and writing stats events in that case, so nothing else would notice.
 * Uses decoder.pkts from eve.json stats events, which exists in every capture mode (af-packet, pcap, NFQ).
 * Stays silent until the first stats event, so installs with stats disabled in eve.json never get a false alarm.
 */
module.exports = ({ logger, stallTimeout = DEFAULT_STALL_TIMEOUT, checkInterval = DEFAULT_CHECK_INTERVAL, now = Date.now }) => {
	let lastPackets = null;
	let lastChange = null;
	let lastStats = null;
	let alerted = null;
	let timer = null;

	const minutes = ms => Math.round(ms / 60000);

	const onLine = line => {
		if (!line?.includes('"event_type":"stats"')) return;

		let packets;
		try {
			packets = JSON.parse(line).stats?.decoder?.pkts;
		} catch {
			return;
		}
		if (!Number.isSafeInteger(packets)) return;

		const time = now();
		lastStats = time;

		// A lower value means Suricata was restarted and its counters were reset
		if (lastPackets === null || packets !== lastPackets) {
			if (alerted && lastPackets !== null) logger.success(`Suricata is receiving packets again (decoder.pkts: ${packets})`, { discord: true });
			alerted = null;
			lastPackets = packets;
			lastChange = time;
		}
	};

	const check = () => {
		if (lastStats === null) return;

		const time = now();
		if (time - lastStats >= stallTimeout) {
			if (alerted === 'stats') return;
			alerted = 'stats';
			return logger.warn(`No stats events in eve.json for ${minutes(time - lastStats)} minutes. Suricata may have stopped or stopped writing to the file.`, { discord: true });
		}

		if (time - lastChange >= stallTimeout && alerted !== 'packets') {
			alerted = 'packets';
			logger.warn(`Suricata has not received any packets for ${minutes(time - lastChange)} minutes (decoder.pkts stuck at ${lastPackets}). Check the capture interface and the switch mirror port.`, { discord: true });
		}
	};

	const start = () => {
		timer ??= setInterval(check, checkInterval);
		timer.unref?.();
	};

	const stop = () => {
		clearInterval(timer);
		timer = null;
	};

	return Object.freeze({ onLine, check, start, stop });
};
