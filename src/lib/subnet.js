// Преобразование IP-строки в число
export function ipToNumber(ip) {
  const raw = ip.trim().split('.');
  // Каждая часть — от 1 до 3 цифр, иначе "192.168.1." или "1..2.3" проходили как валидные
  if (raw.length !== 4 || raw.some((p) => !/^\d{1,3}$/.test(p))) {
    throw new Error('Некорректный IP-адрес');
  }
  const parts = raw.map(Number);
  if (parts.some((p) => p > 255)) {
    throw new Error('Некорректный IP-адрес');
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Преобразование числа обратно в IP-строку
export function numberToIp(num) {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

// Преобразование CIDR (например 24) в маску-число
export function cidrToMaskNumber(cidr) {
  if (cidr < 0 || cidr > 32) throw new Error('CIDR должен быть от 0 до 32');
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
}

// Преобразование маски в формате 255.255.255.0 в CIDR-число
export function maskToCidr(maskStr) {
  const num = ipToNumber(maskStr);
  const cidr = num.toString(2).split('1').length - 1;
  // Единицы маски должны идти подряд слева: 255.0.255.0 — не маска
  if (cidrToMaskNumber(cidr) !== num) throw new Error('Некорректная маска');
  return cidr;
}

// Принимает маску в любом формате ("24" или "/24" или "255.255.255.0") и возвращает CIDR
export function parseMaskInput(input) {
  const trimmed = input.trim().replace('/', '');
  if (trimmed.includes('.')) {
    return maskToCidr(trimmed);
  }
  if (!/^\d{1,2}$/.test(trimmed)) throw new Error('Некорректная маска');
  return Number(trimmed);
}

export function isPrivate(ipNum) {
  const ranges = [
    [ipToNumber('10.0.0.0'), ipToNumber('10.255.255.255')],
    [ipToNumber('172.16.0.0'), ipToNumber('172.31.255.255')],
    [ipToNumber('192.168.0.0'), ipToNumber('192.168.255.255')],
  ];
  return ranges.some(([start, end]) => ipNum >= start && ipNum <= end);
}

export function getNetworkClass(ipNum) {
  const firstOctet = (ipNum >>> 24) & 255;
  if (firstOctet < 128) return 'A';
  if (firstOctet < 192) return 'B';
  if (firstOctet < 224) return 'C';
  if (firstOctet < 240) return 'D (multicast)';
  return 'E (экспериментальный)';
}

// Основной калькулятор подсети
export function calculateSubnet(ipStr, maskInput) {
  const ipNum = ipToNumber(ipStr);
  const cidr = parseMaskInput(maskInput);
  const maskNum = cidrToMaskNumber(cidr);
  const wildcardNum = (~maskNum) >>> 0;

  const networkNum = (ipNum & maskNum) >>> 0;
  const broadcastNum = (networkNum | wildcardNum) >>> 0;

  const totalHosts = Math.pow(2, 32 - cidr);
  // /31 — два адреса для point-to-point (RFC 3021), /32 — один адрес
  const usableHosts = cidr >= 31 ? totalHosts : totalHosts - 2;

  const firstHostNum = cidr >= 31 ? networkNum : networkNum + 1;
  const lastHostNum = cidr >= 31 ? broadcastNum : broadcastNum - 1;

  return {
    ip: ipStr,
    cidr,
    mask: numberToIp(maskNum),
    wildcard: numberToIp(wildcardNum),
    network: numberToIp(networkNum),
    broadcast: numberToIp(broadcastNum),
    firstHost: numberToIp(firstHostNum),
    lastHost: numberToIp(lastHostNum),
    totalHosts,
    usableHosts,
    networkClass: getNetworkClass(ipNum),
    isPrivate: isPrivate(ipNum),
  };
}

// VLSM: делит родительскую сеть на подсети под заданные требования по хостам
export function calculateVLSM(parentIp, parentMaskInput, requirements) {
  const parentCidr = parseMaskInput(parentMaskInput);
  const parentMaskNum = cidrToMaskNumber(parentCidr);
  const parentNetworkNum = (ipToNumber(parentIp) & parentMaskNum) >>> 0;
  const parentTotalHosts = Math.pow(2, 32 - parentCidr);

  // Сортируем требования по убыванию нужных хостов — так VLSM работает корректно
  const sorted = [...requirements]
    .map((r) => ({ ...r, hostsNeeded: Number(r.hosts) }))
    .sort((a, b) => b.hostsNeeded - a.hostsNeeded);

  let cursor = parentNetworkNum;
  const results = [];
  const parentEnd = parentNetworkNum + parentTotalHosts - 1;

  for (const req of sorted) {
    if (!Number.isInteger(req.hostsNeeded) || req.hostsNeeded < 1) {
      results.push({ name: req.name, error: 'Число хостов должно быть целым и больше 0' });
      continue;
    }

    // Находим минимальный размер подсети (степень двойки), вмещающий hosts + 2 (сеть и broadcast)
    const needed = req.hostsNeeded + 2;
    const newHostBits = Math.max(0, Math.ceil(Math.log2(needed)));
    const subnetCidr = 32 - newHostBits;
    const subnetSize = Math.pow(2, newHostBits);

    if (subnetCidr < parentCidr) {
      results.push({ name: req.name, error: 'Не помещается в родительскую сеть' });
      continue;
    }

    // Выравниваем курсор по границе подсети
    const alignedStart = Math.ceil(cursor / subnetSize) * subnetSize;

    if (alignedStart + subnetSize - 1 > parentEnd) {
      results.push({ name: req.name, error: 'Недостаточно места в родительской сети' });
      continue;
    }

    const networkNum = alignedStart;
    const broadcastNum = networkNum + subnetSize - 1;

    results.push({
      name: req.name,
      hostsNeeded: req.hostsNeeded,
      cidr: subnetCidr,
      mask: numberToIp(cidrToMaskNumber(subnetCidr)),
      network: numberToIp(networkNum),
      broadcast: numberToIp(broadcastNum),
      firstHost: numberToIp(subnetCidr >= 31 ? networkNum : networkNum + 1),
      lastHost: numberToIp(subnetCidr >= 31 ? broadcastNum : broadcastNum - 1),
      usableHosts: subnetCidr >= 31 ? subnetSize : subnetSize - 2,
    });

    cursor = broadcastNum + 1;
  }

  // Возвращаем в исходном порядке, если нужно — но проще оставить по убыванию размера
  return results;
}
