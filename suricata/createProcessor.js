module.exports = ({
	policy,
	report,
	isReportedRecently,
	markReported,
	persistReported,
	deferPending,
	logReview,
	logSkip,
	logger,
	maxConcurrent = 4,
	maxPending = 1000,
}) => {
	if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new Error('maxConcurrent must be a positive integer');
	if (!Number.isInteger(maxPending) || maxPending < maxConcurrent) throw new Error('maxPending must be an integer >= maxConcurrent');

	// IP -> promise of its in-flight job. Deduplicates alerts for the same IP that arrive before the cache is updated.
	const pending = new Map();
	const queue = [];
	let idleWaiters = [];
	let active = 0;
	let accepting = true;

	const run = async ({ data }) => {
		if (isReportedRecently(data.srcIp)) return;

		// Whitelist, server IPs or rules may have changed while the job was waiting
		const current = policy.evaluate(data.evidence);
		if (!current) return;

		const result = await report(current);
		if (result !== 'reported') return;

		markReported(current.srcIp);
		await persistReported();
	};

	const drain = () => {
		while (active < maxConcurrent && queue.length) {
			const job = queue.shift();
			active++;

			run(job)
				.catch(err => logger.error(`Failed to process alert for ${job.data.srcIp}: ${err.message}`))
				.finally(() => {
					active--;
					pending.delete(job.data.srcIp);
					job.resolve();
					drain();

					if (!active && !queue.length) {
						for (const resolve of idleWaiters) resolve();
						idleWaiters = [];
					}
				});
		}
	};

	const processLine = async (line, test = false) => {
		if (!accepting || !line?.includes('"alert"')) return;

		let event;
		try {
			event = JSON.parse(line);
		} catch {
			return;
		}

		const data = policy.evaluate(event, logSkip);
		if (!data) return;
		if (test) return data;

		if (data.review) return logReview(data);

		if (isReportedRecently(data.srcIp)) return logSkip?.(`${data.srcIp} was reported recently`);
		if (pending.has(data.srcIp)) return pending.get(data.srcIp);
		if (pending.size >= maxPending) return logger.warn(`Alert queue is full (${maxPending}). Skipping ${data.srcIp}`);

		const promise = new Promise(resolve => queue.push({ data, resolve }));
		pending.set(data.srcIp, promise);
		drain();

		return promise;
	};

	const stop = async () => {
		accepting = false;

		const waiting = queue.splice(0);
		await deferPending?.(waiting.map(job => job.data));

		for (const job of waiting) {
			pending.delete(job.data.srcIp);
			job.resolve();
		}

		if (active) await new Promise(resolve => idleWaiters.push(resolve));
	};

	return Object.freeze({ processLine, stop });
};
