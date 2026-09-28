// Перевод IPv4-адреса из строки "192.168.1.10" в число (32 бита)
export function ipToInt(ip) {
  const parts = String(ip).trim().split('.');
  if (parts.length !== 4) throw new Error('IP должен состоять из 4 частей');
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) throw new Error('Неверная часть IP: ' + p);
    const v = Number(p);
    if (v > 255) throw new Error('Часть IP больше 255: ' + p);
    n = n * 256 + v;
  }
  return n;
}

// Обратно: число -> "192.168.1.10"
export function intToIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

// Расчёт подсети по записи вида "192.168.1.10/24"
export function calcSubnet(input) {
  const [ip, pre] = String(input).trim().split('/');
  if (pre === undefined || !/^\d{1,2}$/.test(pre)) throw new Error('Нужен формат IP/префикс, например 192.168.1.0/24');
  const prefix = Number(pre);
  if (prefix > 32) throw new Error('Префикс должен быть от 0 до 32');

  const addr = ipToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (addr & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const total = 2 ** (32 - prefix);

  let first, last, hosts;
  if (prefix === 32) { first = last = network; hosts = 1; }
  else if (prefix === 31) { first = network; last = broadcast; hosts = 2; }
  else { first = network + 1; last = broadcast - 1; hosts = total - 2; }

  return {
    prefix,
    mask: intToIp(mask),
    wildcard: intToIp(~mask >>> 0),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(first),
    lastHost: intToIp(last),
    hosts,
  };
}
