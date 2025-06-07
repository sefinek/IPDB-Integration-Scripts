const fs = require('node:fs');
const path = require('node:path');

if (process.argv.includes('--help')) {
	const readme = path.join(__dirname, '..', 'README.md');
	if (!fs.existsSync(readme)) {
		console.log('No README.md found.\n');
		process.exit(1);
	}

	const lines = fs.readFileSync(readme, 'utf8').split('\n');
	const start = lines.findIndex(l => l.startsWith('| `--'));
	if (start === -1) {
		console.log('No valid CLI options found in README.md.\n');
		process.exit(1);
	}

	const options = [];
	for (let i = start; i < lines.length && lines[i].startsWith('|'); i++) {
		const cols = lines[i].split('|').map(v => v.trim());
		if (cols.length < 3) continue;
		const name = cols[1].replace(/`/g, '');
		const desc = cols[2].replace(/\s+/g, ' ');
		if (name && desc) options.push([name, desc]);
	}

	const pad = Math.max(...options.map(([n]) => n.length)) + 2;
	console.log('\nUsage: node . [options]\n\nOptions:');
	for (const [name, desc] of options) {
		console.log(`  ${name.padEnd(pad)}${desc}`);
	}
	console.log('\nExample: node . --run-on-start\n');

	process.exit(0);
}