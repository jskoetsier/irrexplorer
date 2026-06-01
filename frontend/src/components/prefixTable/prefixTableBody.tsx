import { Link } from 'react-router-dom';
import AsnWithRPKIStatus from './asnWithRPKIStatus';
import MessageBadge from './messageBadge';
import type { PrefixData, RPKIStatus, MessageCategory } from '../../types';

interface PrefixTableBodyProps {
  irrSourceColumns: string[];
  prefixesData: PrefixData[];
  reducedColour: boolean;
  filterWarningError: boolean;
  handleIrrRouteSelect: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => void;
}

export default function PrefixTableBody({
  irrSourceColumns,
  prefixesData,
  reducedColour,
  filterWarningError,
  handleIrrRouteSelect,
}: PrefixTableBodyProps) {
  const renderSourceCell = (prefix: string, irrRoutes: PrefixData['irrRoutes'], sourceName: string) => {
    const routesForSource = irrRoutes[sourceName];
    if (!routesForSource) {
      return (
        <td key={sourceName} className="px-4 py-3 border-b border-[#3d4a3d]/10 text-on-surface-variant/20 font-data-mono text-center">—</td>
      );
    }
    return (
      <td key={sourceName} className="px-4 py-3 border-b border-[#3d4a3d]/10">
        <div className="flex flex-wrap gap-1 items-center">
          {routesForSource.map(({ asn, rpkiStatus, rpslText }, idx) => (
            <span key={`${asn}-${idx}`} className="inline-flex items-center">
              {idx > 0 && <span className="text-on-surface-variant/40 mr-1">,</span>}
              <button
                type="button"
                onClick={() => handleIrrRouteSelect(prefix, asn, sourceName, rpslText, rpkiStatus)}
                className="hover:underline text-left"
              >
                <AsnWithRPKIStatus asn={asn} rpkiStatus={rpkiStatus} />
              </button>
            </span>
          ))}
        </div>
      </td>
    );
  };

  const renderRpkiCells = (rpkiRoutes: PrefixData['rpkiRoutes']) => {
    const safeRpkiRoutes = rpkiRoutes ?? [];
    if (!safeRpkiRoutes.length) {
      return (
        <td key="rpkiRoutes" className="px-4 py-3 border-b border-[#3d4a3d]/10 text-on-surface-variant/20 font-data-mono">—</td>
      );
    }
    return (
      <td key="rpkiRoutes" className="px-4 py-3 border-b border-[#3d4a3d]/10 font-data-mono text-xs text-on-surface-variant">
        <div className="flex flex-wrap gap-1 items-center">
          {safeRpkiRoutes.map(({ asn, rpkiMaxLength }, idx) => (
            <span key={`${asn}-${idx}`}>
              {idx > 0 && <span className="text-on-surface-variant/40 mr-1">,</span>}
              <span className="text-primary font-bold">AS{asn}</span>
              <span className="text-[10px] bg-[#1e2024] px-1 py-0.5 rounded border border-[#3d4a3d]/20 ml-1 inline-flex items-center">
                <span className="material-symbols-outlined text-[10px] leading-none">arrow_right_alt</span>
                <span>/{rpkiMaxLength}</span>
              </span>
            </span>
          ))}
        </div>
      </td>
    );
  };

  const classNameForRow = (categoryOverall: MessageCategory) => {
    const base = 'transition-all duration-200 ';
    if (reducedColour) return base + 'zebra-row hover:bg-[#333539]/20';
    switch (categoryOverall) {
      case 'danger':
        return base + 'hover:bg-red-950/10 border-l-[3px] border-red-500 bg-red-950/5';
      case 'warning':
        return base + 'hover:bg-amber-950/10 border-l-[3px] border-secondary bg-amber-950/5';
      case 'success':
        return base + 'hover:bg-[#22c55e]/5 border-l-[3px] border-primary bg-primary/5';
      default:
        return base + 'hover:bg-blue-950/10 border-l-[3px] border-blue-500 bg-blue-950/5';
    }
  };

  let tableData = prefixesData;
  if (filterWarningError) {
    tableData = tableData.filter(
      ({ categoryOverall }) => categoryOverall === 'danger' || categoryOverall === 'warning'
    );
  }

  if (!tableData.length) {
    return (
      <tbody>
        <tr key="nodata" className="zebra-row">
          <td colSpan={100} className="px-4 py-6 text-center text-xs text-on-surface-variant font-data-mono">
            No records match the active filter criteria.
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="divide-y divide-[#3d4a3d]/10 font-data-mono text-xs">
      {tableData.map(({ prefix, categoryOverall, rir, bgpOrigins, rpkiRoutes, irrRoutes, messages }) => {
        const safeBgpOrigins = bgpOrigins ?? [];
        const safeRpkiRoutes = rpkiRoutes ?? [];
        const safeIrrRoutes = irrRoutes ?? {};
        const safeMessages = messages ?? [];
        return (
          <tr key={prefix} className={classNameForRow(categoryOverall)}>
            <td key="prefix" className="px-4 py-3 border-b border-[#3d4a3d]/10">
              <Link to={`/prefix/${prefix}`} className="text-primary hover:underline font-bold font-data-mono">
                {prefix}
              </Link>
            </td>
            <td key="rir" className="px-4 py-3 border-b border-[#3d4a3d]/10 text-on-surface-variant font-semibold">
              {rir}
            </td>
            <td key="bgpOrigins" className="px-4 py-3 border-b border-[#3d4a3d]/10 font-bold">
              {safeBgpOrigins.length > 0 ? (
                <a
                  href={`https://lg.ring.nlnog.net/prefix?q=${prefix}&match=exact&peer=all`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline"
                >
                  {safeBgpOrigins.map(o => `AS${o}`).join(', ')}
                </a>
              ) : (
                <span className="text-on-surface-variant/20">—</span>
              )}
            </td>
            {renderRpkiCells(safeRpkiRoutes)}
            {irrSourceColumns.map((sourceName) => renderSourceCell(prefix, safeIrrRoutes, sourceName))}
            <td key="messages" className="px-4 py-3 border-b border-[#3d4a3d]/10">
              <div className="flex flex-col gap-0.5 max-w-sm">
                {safeMessages.map(({ category, text }) => (
                  <MessageBadge key={text} category={category} text={text} reducedColour={reducedColour} />
                ))}
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
