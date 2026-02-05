# Integration Scripts

## Supported Services
- [SniffCat](https://sniffcat.com)
- [AbuseIPDB](https://www.abuseipdb.com/user/158699)
- [SpamVerify](https://spamverify.com/user/108395000)

## Used for
|            | [SniffCat](https://sniffcat.com)                                                       | [AbuseIPDB](https://www.abuseipdb.com/user/158699)                                    | [SpamVerify](https://spamverify.com/user/108395000)                           |
|------------|----------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|:------------------------------------------------------------------------------|
| UFW        | [UFW-SniffCat-Reporter](https://github.com/SniffCatDB/UFW-SniffCat-Reporter)           | [UFW-AbuseIPDB-Reporter](https://github.com/sefinek/UFW-AbuseIPDB-Reporter)           | [UFW-SpamVerify-Reporter](https://github.com/sefinek/UFW-SpamVerify-Reporter) |
| Cloudflare | [Cloudflare-WAF-To-SniffCat](https://github.com/SniffCatDB/Cloudflare-WAF-To-SniffCat) | [Cloudflare-WAF-To-AbuseIPDB](https://github.com/sefinek/Cloudflare-WAF-To-AbuseIPDB) |                                                                               |
| T-Pot      | [T-Pot-To-SniffCat](https://github.com/SniffCatDB/T-Pot-To-SniffCat)                   | [T-Pot-To-AbuseIPDB](https://github.com/sefinek/T-Pot-To-AbuseIPDB)                   |                                                                               |
| Suricata   | Soon                                                                                   | [Suricata-To-AbuseIPDB](https://github.com/sefinek/Suricata-To-AbuseIPDB)             |                                                                               |

## Terms
| Key         | Description                                          |
|-------------|------------------------------------------------------|
| `timestamp` | Event timestamp (UTC format)                         |
| `srcIp`     | Source IP address (attacker)                         |
| `dstIp`     | Destination IP address (victim/server)               |
| `proto`     | Protocol used (e.g., TCP, SSH, TELNET, MONGOD)       |
| `spt`       | Source port number                                   |
| `dpt`       | Destination port number                              |
| `in`        | Incoming network interface name (e.g., enp1s0, ens3) |
| `out`       | Outgoing network interface name                      |
| `mac`       | MAC address information                              |
| `len`       | Total packet length (in bytes)                       |
| `ttl`       | Packet TTL (Time To Live)                            |
| `id`        | Packet ID                                            |
| `tos`       | Type of Service field in IP header                   |
| `prec`      | Precedence value in TOS field                        |
| `window`    | TCP window size                                      |
| `urgp`      | TCP urgent pointer                                   |
