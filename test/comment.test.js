const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_COMMENT_LENGTH, truncateComment, joinWithinLimit } = require('../comment.js');

test('truncateComment leaves short comments and non-strings unchanged', () => {
	assert.equal(truncateComment('short'), 'short');
	assert.equal(truncateComment('x'.repeat(MAX_COMMENT_LENGTH)), 'x'.repeat(MAX_COMMENT_LENGTH));
	assert.equal(truncateComment(undefined), undefined);
	assert.equal(truncateComment(null), null);
});

test('truncateComment respects the limit and appends an ellipsis', () => {
	const result = truncateComment('x'.repeat(MAX_COMMENT_LENGTH + 100));
	assert.equal(result.length, MAX_COMMENT_LENGTH);
	assert.ok(result.endsWith('...'));

	assert.equal(truncateComment('abcdefghij', 8), 'abcde...');
});

test('truncateComment trims trailing whitespace before the ellipsis', () => {
	assert.equal(truncateComment('abcd      xyz', 8), 'abcd...');
});

test('truncateComment never splits a surrogate pair', () => {
	const result = truncateComment(`${'a'.repeat(4)}😀😀😀`, 8);
	assert.equal(result, 'aaaa...');
	assert.doesNotThrow(() => encodeURIComponent(result));
});

test('joinWithinLimit joins all items when they fit', () => {
	assert.equal(joinWithinLimit(['a', 'b', 'c'], 100), 'a, b, c');
	assert.equal(joinWithinLimit(['a', 'b'], 100, ' | '), 'a | b');
});

test('joinWithinLimit stops at whole items and appends an ellipsis', () => {
	const result = joinWithinLimit(['alpha', 'beta', 'gamma', 'delta'], 18);
	assert.equal(result, 'alpha, beta...');
	assert.ok(result.length <= 18);
});

test('joinWithinLimit truncates the first item when even that does not fit', () => {
	const result = joinWithinLimit(['x'.repeat(50), 'y'], 20);
	assert.equal(result.length, 20);
	assert.ok(result.endsWith('...'));
	assert.equal(joinWithinLimit([], 10), '');
});
