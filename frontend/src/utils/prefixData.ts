import { uniq, orderBy } from 'lodash';
import type { PrefixData } from '../types';

export function findIrrSourceColumns(prefixesData: PrefixData[]): string[] {
  const irrSources: string[] = [];
  for (const prefixData of prefixesData) {
    const sourcesForPrefix = Object.keys(prefixData.irrRoutes);
    irrSources.push(...sourcesForPrefix);
  }
  return uniq(irrSources).sort();
}

export function findLeastSpecific(queryPrefix: string, prefixesData: PrefixData[]): string | null {
  if (!prefixesData.length) return null;
  
  const queryPrefixLength = parseInt(queryPrefix.split('/')[1], 10);
  const allPrefixes = prefixesData.map(({ prefix }) => {
    const [ip, len] = prefix.split('/');
    return { ip, len: parseInt(len, 10) };
  });
  allPrefixes.sort((a, b) => a.len - b.len);
  const leastSpecific = allPrefixes[0];
  
  if (!queryPrefixLength || leastSpecific.len < queryPrefixLength) {
    return `${leastSpecific.ip}/${leastSpecific.len}`;
  }
  return null;
}

export function sortPrefixesDataBy(
  prefixesData: PrefixData[],
  key: string,
  order: 'asc' | 'desc' = 'asc'
): PrefixData[] {
  let sortKey: string = key;
  if (key === 'prefix') sortKey = 'prefixSortKeyIpPrefix' as keyof PrefixData as string;
  if (key === 'prefixSmallestFirst') sortKey = 'prefixSortKeyReverseNetworklenIp' as keyof PrefixData as string;
  if (key === 'bgpOrigins') sortKey = 'bgpOrigins.0';
  if (key === 'rpkiRoutes') sortKey = 'rpkiRoutes.0.asn';
  if (key.startsWith('irrRoutes')) sortKey += '.0.asn';
  if (key === 'messages') sortKey = 'goodnessOverall' as keyof PrefixData as string;

  return orderBy(prefixesData, [sortKey], [order]);
}
