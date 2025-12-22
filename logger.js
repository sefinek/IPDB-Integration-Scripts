const { reset, IS_PM2 } = require('./banners/utils/helper.js');
const { axiosWebhook } = require('./services/axios.js');
const repoInfo = require('./repo.js');
const { SERVER_ID, DISCORD_WEBHOOK_ENABLED, DISCORD_WEBHOOK_URL, DISCORD_WEBHOOK_USERNAME, DISCORD_USER_ID } = require('../config.js').MAIN;

const LEVELS = Object.freeze({
	0: { method: 'log', label: '[i]', color: '\x1b[38;5;38m', hex: 0x00AEEF, name: 'INFO' },
	1: { method: 'log', label: '[✓]', color: '\x1b[38;5;77m', hex: 0x3CB371, name: 'SUCCESS' },
	2: { method: 'warn', label: '[!]', color: '\x1b[38;5;208m', hex: 0xFF8C00, name: 'WARNING' },
	3: { method: 'error', label: '[X]', color: '\x1b[38;5;160m', hex: 0xD32F2F, name: 'ERROR' },
});

const WEBHOOK_BURST_LIMIT = 3, WEBHOOK_COOLDOWN = 3000;
const webhookQueue = [];
let webhookBurstCount = 0, webhookLastSent = 0;

class Logger {
	static #getLevel(level) {
		return LEVELS[level] ?? LEVELS[0];
	}

	static #normalizeOptions(options, defaultDiscord, defaultPing) {
		if (typeof options === 'boolean') return { discord: defaultDiscord, ping: options };
		return {
			discord: options.discord ?? defaultDiscord,
			ping: options.ping ?? defaultPing,
		};
	}

	static print(msg, level = 0) {
		const { method, label, color: lvlColor } = this.#getLevel(level);
		const fn = console[method] || console.log;

		if (IS_PM2) {
			fn(`${label} ${msg}`);
		} else {
			fn(`${lvlColor}${label} ${msg}${reset}`);
		}
	}

	static async #sendToDiscord(msg, hex, ping) {
		if (!msg || !DISCORD_WEBHOOK_ENABLED || !DISCORD_WEBHOOK_URL) return;

		try {
			const res = await axiosWebhook.post(DISCORD_WEBHOOK_URL, {
				username: DISCORD_WEBHOOK_USERNAME === 'SERVER_ID' ? SERVER_ID : DISCORD_WEBHOOK_USERNAME || null,
				content: (ping && DISCORD_USER_ID) ? `**[<@${DISCORD_USER_ID}>]**` : undefined,
				embeds: [{
					description: msg
						.replace(/(\b\w+=)/g, '**$1**')
						.replace(/'/g, '`')
						.trim(),
					color: hex ?? 0x008FD1,
					footer: {
						text: `${SERVER_ID ? `${SERVER_ID} • ` : ''}${repoInfo.repoSlug} [v${repoInfo.version}]`,
					},
					timestamp: new Date().toISOString(),
				}],
			});

			if (res.status !== 204) {
				this.print(`Failed to deliver Discord Webhook (unexpected status code: ${res.status})`, 2);
			}
		} catch (err) {
			this.print(`Discord Webhook Error: ${err.message}`, 3);
		}
	}

	static async webhook(msg, levelOrHex = 0, ping = false) {
		const isLevel = typeof levelOrHex === 'number' && levelOrHex >= 0 && levelOrHex <= 3;
		const hex = isLevel ? this.#getLevel(levelOrHex).hex : levelOrHex;

		const now = Date.now();
		if (now - webhookLastSent > WEBHOOK_COOLDOWN) webhookBurstCount = 0;

		if (webhookBurstCount >= WEBHOOK_BURST_LIMIT) {
			webhookQueue.push({ msg, hex, ping });
			if (webhookQueue.length === 1) {
				this.print('Discord webhook rate limit reached. Some messages were scheduled for later delivery.', 2);
				setTimeout(() => this.#processWebhookQueue(), WEBHOOK_COOLDOWN);
			}
			return;
		}

		try {
			await this.#sendToDiscord(msg, hex, ping);
			webhookLastSent = now;
			webhookBurstCount++;

			if (webhookQueue.length > 0) setTimeout(() => this.#processWebhookQueue(), WEBHOOK_COOLDOWN);
		} catch (err) {
			this.print(`Discord webhook delivery failed: ${err.message}`, 3);
		}
	}

	static async #processWebhookQueue() {
		if (webhookQueue.length === 0) return;

		if (Date.now() - webhookLastSent > WEBHOOK_COOLDOWN) webhookBurstCount = 0;

		const { msg, hex, ping } = webhookQueue.shift();
		this.print(`Processing queued webhook (${webhookQueue.length} remaining)`, 0);

		try {
			await this.#sendToDiscord(msg, hex, ping);
			webhookLastSent = Date.now();
			webhookBurstCount = 1;
		} catch (err) {
			this.print(`Queued webhook failed: ${err.message}`, 3);
		}

		if (webhookQueue.length > 0) setTimeout(() => this.#processWebhookQueue(), WEBHOOK_COOLDOWN);
	}

	static log(msg, level = 0, options = {}) {
		this.print(msg, level);

		if (options.discord) {
			this.webhook(msg, level, options.ping)
				.catch(err => console.error('[Logger] Webhook error:', err.message));
		}
	}

	static info(msg, options = {}) {
		const opts = this.#normalizeOptions(options, false, false);
		this.log(msg, 0, opts);
	}

	static success(msg, options = {}) {
		const opts = this.#normalizeOptions(options, false, false);
		this.log(msg, 1, opts);
	}

	static warn(msg, options = {}) {
		const opts = this.#normalizeOptions(options, true, false);
		this.log(msg, 2, opts);
	}

	static error(msg, options = {}) {
		const opts = this.#normalizeOptions(options, true, false);
		this.log(msg, 3, opts);
	}

	static getWebhookQueueSize() {
		return webhookQueue.length;
	}
}

module.exports = Logger;
