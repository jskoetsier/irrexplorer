import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import ExportButtons from './exportButtons';
import api from '../services/api';
import PrefixQuery from './prefixQuery';
import ASNQuery from './asnQuery';
import SetQuery from './setQuery';
import type { QueryCategory } from '../types';
import { setSeo } from '../utils/seo';

export default function Query() {
  const { query, query1, query2, category } = useParams();
  const navigate = useNavigate();
  const [cleanQuery, setCleanQuery] = useState('');
  const [queryCategory, setQueryCategory] = useState<QueryCategory>('prefix');
  const [reducedColour, setReducedColour] = useState(false);
  const [filterWarningError, setFilterWarningError] = useState(false);

  const queryInput = () => query ?? (query1 && query2 ? `${query1}/${query2}` : '');

  const cleanAndNavigate = useCallback(async () => {
    const inputQuery = queryInput();
    if (!inputQuery) return;

    const cleanResult = await api.cleanQuery(inputQuery);
    if (cleanResult.error) {
      navigate('/');
    } else if (cleanResult.category !== category) {
      navigate(`/${cleanResult.category}/${cleanResult.cleanedValue}`, { replace: true });
    } else {
      setCleanQuery(cleanResult.cleanedValue);
      setQueryCategory(cleanResult.category);
      setSeo({
        title: `IRRExplorer | ${cleanResult.cleanedValue}`,
        description: getQueryDescription(cleanResult.category, cleanResult.cleanedValue),
        path: `/${cleanResult.category}/${cleanResult.cleanedValue}`,
      });
    }
  }, [query, query1, query2, category, navigate]);

  useEffect(() => {
    cleanAndNavigate();
  }, [cleanAndNavigate]);


  const formatCategoryTitle = (cat: QueryCategory) => {
    switch (cat) {
      case 'asn':
        return 'Autonomous System';
      case 'prefix':
        return 'IP Prefix';
      case 'as-set':
        return 'AS Set';
      case 'route-set':
        return 'Route Set';
      default:
        return 'Network Asset';
    }
  };

  return (
    <div className="space-y-lg animate-in fade-in duration-300">
      {/* Redesigned Query Header */}
      <section className="border-b border-[#3d4a3d]/20 pb-md flex flex-col lg:flex-row lg:items-center justify-between gap-md">
        <div>
          <div className="flex items-center gap-2 mb-xs">
            <span className="bg-[#1e2024] border border-[#3d4a3d]/40 px-2 py-0.5 font-data-mono text-xs text-primary font-bold uppercase rounded">
              {formatCategoryTitle(queryCategory)}
            </span>
            <span className="text-[10px] text-on-surface-variant font-data-mono bg-[#1e2024] px-2 py-0.5 rounded border border-[#3d4a3d]/20">
              Validated query
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-on-surface font-bold tracking-tight">
            Routing Analysis for <span className="text-primary">{cleanQuery}</span>
          </h1>
          <p className="text-on-surface-variant font-body-base mt-1 text-sm">
            Displaying live aggregate lookup paths, BGP origin announcements, and cryptographic validation records.
          </p>
        </div>

        {/* Action Controls Well */}
        <div className="flex flex-wrap items-center gap-md bg-[#1e2024]/40 border border-[#3d4a3d]/20 p-sm rounded-xl">
          {cleanQuery && (
            <div className="border-r border-[#3d4a3d]/20 pr-md py-1">
              <ExportButtons query={cleanQuery} queryType={queryCategory} />
            </div>
          )}
          
          <form className="flex flex-col sm:flex-row gap-md select-none text-xs font-label-caps font-bold text-on-surface-variant">
            <label className="flex items-center gap-2 cursor-pointer hover:text-on-surface transition-colors">
              <input
                type="checkbox"
                checked={reducedColour}
                onChange={(e) => setReducedColour(e.target.checked)}
                className="rounded border-[#3d4a3d] bg-[#1a1c20] text-primary focus:ring-0 focus:ring-offset-0"
              />
              <span>REDUCED COLOR MODE</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer hover:text-on-surface transition-colors">
              <input
                type="checkbox"
                checked={filterWarningError}
                onChange={(e) => setFilterWarningError(e.target.checked)}
                className="rounded border-[#3d4a3d] bg-[#1a1c20] text-primary focus:ring-0 focus:ring-offset-0"
              />
              <span>ERRORS / WARNINGS ONLY</span>
            </label>
          </form>
        </div>
      </section>

      {/* Main Report Container */}
      <section className="space-y-lg pt-sm">
        {cleanQuery && queryCategory === 'prefix' && (
          <PrefixQuery
            query={cleanQuery}
            reducedColour={reducedColour}
            filterWarningError={filterWarningError}
          />
        )}
        {cleanQuery && queryCategory === 'asn' && (
          <ASNQuery
            query={cleanQuery}
            reducedColour={reducedColour}
            filterWarningError={filterWarningError}
          />
        )}
        {cleanQuery && (queryCategory === 'as-set' || queryCategory === 'route-set') && (
          <SetQuery
            query={cleanQuery}
            queryCategory={queryCategory}
          />
        )}
      </section>
    </div>
  );
}

function getQueryDescription(category: QueryCategory, value: string): string {
  switch (category) {
    case 'prefix':
      return `Analyze prefix ${value} with IRR routes, BGP visibility, RPKI status, and related routing data in IRRExplorer.`;
    case 'asn':
      return `Analyze ASN ${value} with announced prefixes, IRR route objects, BGP visibility, and RPKI data in IRRExplorer.`;
    case 'as-set':
      return `Expand and inspect AS-SET ${value} with IRRExplorer.`;
    case 'route-set':
      return `Expand and inspect route-set ${value} with IRRExplorer.`;
    default:
      return `Inspect routing data for ${value} in IRRExplorer.`;
  }
}
