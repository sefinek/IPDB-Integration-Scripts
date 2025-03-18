const processLogLine = require('../../index.js');

const str =
    'Mar 18 20:57:59 sefinek-vps kernel: [1040183.303389] [UFW BLOCK] IN=ens3 OUT= MAC=00:d8:0f:6d:ab:20:50:87:89:68:26:73:08:00 SRC=79.186.4.28 DST=45.43.19.39 LEN=40 TOS=0x00 PREC=0x00 TTL=243 ID=54321 PROTO=TCP SPT=43996 DPT=2000 WINDOW=65535 RES=0x00 SYN URGP=0';

(async () => {
	const parsed = await processLogLine(str, false);
	// console.log(parsed);
})();