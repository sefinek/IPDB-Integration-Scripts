const processLogLine = require('../../index.js');

const str =
    'Mar 18 20:57:59 sefinek-vps kernel: [1040183.303389] [UFW BLOCK] IN=ens3 OUT= MAC=f0:9f:c2:6d:1a:35:00:25:96:ab:7c:12:08:00 SRC=79.186.0.0 DST=45.43.10.30 LEN=40 TOS=0x00 PREC=0x00 TTL=243 ID=54321 PROTO=TCP SPT=43996 DPT=2000 WINDOW=65535 RES=0x00 SYN URGP=0';

(async () => {
	const parsed = await processLogLine(str, true);
	console.log(parsed);
})();