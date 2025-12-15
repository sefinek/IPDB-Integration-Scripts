const logger = require('./logger.js');

console.log('=== Testing Logger Rate Limiting ===\n');

// Test 1: Basic logging with timestamps
console.log('Test 1: Basic logging');
logger.info('This is info message');
logger.success('This is success message');
logger.warn('This is warning message');
logger.error('This is error message');

console.log('\n--- Waiting 1 second ---\n');

setTimeout(async () => {
	console.log('Test 2: Webhook queue (simulated)');

	// Simulate rapid webhook calls
	for (let i = 1; i <= 10; i++) {
		await logger.webhook(`Test webhook ${i}`, 0, false);
	}

	console.log(`\nWebhook queue size: ${logger.getWebhookQueueSize()}`);

	setTimeout(() => process.exit(0), 60000);
}, 1000);
