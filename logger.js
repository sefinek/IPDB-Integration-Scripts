const { reset, IS_PM2 } = require('./banners/utils/helper.js');
const { axiosWebhook } = require('./services/axios.js');
const repoInfo = require('./repo.js');
const config = require('../config.js').MAIN;

const LEVELS = Object.freeze({
	0: { method: 'log', label: '[i]', color: '\x1b[38;5;38m', hex: 0x00AEEF, name: 'INFO' },
	1: { method: 'log', label: '[✓]', color: '\x1b[38;5;77m', hex: 0x3CB371, name: 'SUCCESS' },
	2: { method: 'warn', label: '[!]', color: '\x1b[38;5;208m', hex: 0xFF8C00, name: 'WARNING' },
	3: { method: 'error', label: '[X]', color: '\x1b[38;5;160m', hex: 0xD32F2F, name: 'ERROR' },
});

const WEBHOOK_BURST_LIMIT = 3, WEBHOOK_COOLDOWN = 4000;
const webhookQueue = [];
let webhookBurstCount = 0, webhookLastSent = 0;

class Logger {
	static #getLevel(level) {
		return LEVELS[level] ?? LEVELS[0];
	}

	static print(msg, level = 0) {
		const { method, label, color: lvlColor } = this.#getLevel(level);
		if (IS_PM2) {
			console[method](`${label}${msg}`);
		} else {
			console[method](`${lvlColor}${label} ${msg}${reset}`);
		}
	}

	static async #sendToDiscord(msg, hex, pingUser) {
		const { SERVER_ID, DISCORD_WEBHOOK_ENABLED, DISCORD_WEBHOOK_URL, DISCORD_WEBHOOK_USERNAME, DISCORD_USER_ID } = config;
		if (!msg || !DISCORD_WEBHOOK_ENABLED || !DISCORD_WEBHOOK_URL || SERVER_ID === 'development') return;

		try {
			const res = await axiosWebhook.post(DISCORD_WEBHOOK_URL, {
				username: DISCORD_WEBHOOK_USERNAME === 'SERVER_ID' ? SERVER_ID : DISCORD_WEBHOOK_USERNAME || null,
				content: (pingUser && DISCORD_USER_ID) ? `<@${DISCORD_USER_ID}>` : undefined,
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

	static async webhook(msg, levelOrHex = 0, pingUser = false) {
		const isLevel = typeof levelOrHex === 'number' && levelOrHex >= 0 && levelOrHex <= 3;
		const hex = isLevel ? this.#getLevel(levelOrHex).hex : levelOrHex;
		const now = Date.now();
		if (now - webhookLastSent > WEBHOOK_COOLDOWN) webhookBurstCount = 0;

		if (webhookBurstCount >= WEBHOOK_BURST_LIMIT) {
			webhookQueue.push({ msg, hex, pingUser });
			if (webhookQueue.length === 1) this.print(`Webhook rate limit reached. Queued ${webhookQueue.length} message(s).`, 2);
			return;
		}

		try {
			await this.#sendToDiscord(msg, hex, pingUser);
			webhookLastSent = now;
			webhookBurstCount++;

			if (webhookQueue.length > 0) {
				setTimeout(() => this.#processWebhookQueue(), WEBHOOK_COOLDOWN);
			}
		} catch (err) {
			this.print(`Discord webhook delivery failed: ${err.message}`, 3);
		}
	}

	static async #processWebhookQueue() {
		if (webhookQueue.length === 0) return;

		const { msg, hex, pingUser } = webhookQueue.shift();
		this.print(`Processing queued webhook (${webhookQueue.length} remaining)`, 0);

		try {
			await this.#sendToDiscord(msg, hex, pingUser);
			webhookLastSent = Date.now();
		} catch (err) {
			this.print(`Queued webhook failed: ${err.message}`, 3);
		}

		if (webhookQueue.length > 0) {
			setTimeout(() => this.#processWebhookQueue(), WEBHOOK_COOLDOWN);
		}
	}

	static log(msg, level = 0, forceDiscord = false) {
		this.print(msg, level);

		if (forceDiscord || level >= 2) {
			this.webhook(msg, level).catch(err => {
				console.error('[Logger] Webhook error:', err.message);
			});
		}
	}

	static info(msg, sendToDiscord = false) {
		this.log(msg, 0, sendToDiscord);
	}

	static success(msg, sendToDiscord = false) {
		this.log(msg, 1, sendToDiscord);
	}

	static warn(msg, sendToDiscord = true) {
		this.log(msg, 2, sendToDiscord);
	}

	static error(msg, sendToDiscord = true) {
		this.log(msg, 3, sendToDiscord);
	}

	static getWebhookQueueSize() {
		return webhookQueue.length;
	}
}

module.exports = Logger;