import { memo } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight, faCheckCircle, faExclamationCircle, faQuestionCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import AsnWithRPKIStatus from './asnWithRPKIStatus';
import MessageBadge from './messageBadge';
import type { PrefixData, RPKIStatus, MessageCategory } from '../../types';

const icons: Record<MessageCategory, typeof faCheckCircle> = {
  danger: faTimesCircle,
  warning: faExclamationCircle,
  info: faQuestionCircle,
  success: faCheckCircle,
};

interface RowData {
  data: PrefixData[];
  irrSourceColumns: string[];
  reducedColour: boolean;
  handleIrrRouteSelect: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => void;
}

interface VirtualPrefixTableRowProps {
  index: number;
  style: React.CSSProperties;
  data: RowData;
}

function VirtualPrefixTableRow({ index, style, data }: VirtualPrefixTableRowProps) {
  const { data: prefixesData, irrSourceColumns, reducedColour, handleIrrRouteSelect } = data;
  const row = prefixesData[index];
  
  if (!row) return null;

  const { prefix, categoryOverall, rir, bgpOrigins, rpkiRoutes, irrRoutes, messages } = row;
  const safeBgpOrigins = bgpOrigins ?? [];
  const safeRpkiRoutes = rpkiRoutes ?? [];
  const safeIrrRoutes = irrRoutes ?? {};
  const safeMessages = messages ?? [];

  const classNameForRow = (category: MessageCategory) => {
    return reducedColour ? '' : `table-${category}`;
  };

  return (
    <div style={{ ...style, display: 'flex' }} className={`${classNameForRow(categoryOverall)} border-bottom`}>
      {/* Prefix Cell */}
      <div style={{ flex: '0 0 150px', padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Link to={`/prefix/${prefix}`} className="link-dark">
          {prefix}
        </Link>
      </div>

      {/* RIR Cell */}
      <div style={{ flex: '0 0 80px', padding: '8px', whiteSpace: 'nowrap' }}>
        {rir}
      </div>

      {/* BGP Origins Cell */}
      <div style={{ flex: '0 0 100px', padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <a href={`https://lg.ring.nlnog.net/prefix?q=${prefix}&match=exact&peer=all`} className="link-dark">
          {safeBgpOrigins.join(', ')}
        </a>
      </div>

      {/* RPKI Routes Cell */}
      <div style={{ flex: '0 0 120px', padding: '8px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {safeRpkiRoutes.map(({ asn, rpkiMaxLength }, idx) => (
          <span key={idx}>
            {idx > 0 && ', '}
            {asn}{' '}
            <span className="small">
              <FontAwesomeIcon aria-label="max length" icon={faCaretRight} />/{rpkiMaxLength}
            </span>
          </span>
        ))}
      </div>

      {/* IRR Source Columns */}
      {irrSourceColumns.map((sourceName) => {
        const routesForSource = safeIrrRoutes[sourceName];
        return (
          <div 
            key={sourceName} 
            style={{ flex: '0 0 100px', padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {routesForSource?.map(({ asn, rpkiStatus, rpslText }, idx) => (
              <span key={`${asn}-${idx}`}>
                {idx > 0 && ', '}
                <a
                  className="link-dark"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    handleIrrRouteSelect(prefix, asn, sourceName, rpslText, rpkiStatus);
                  }}
                >
                  <AsnWithRPKIStatus asn={asn} rpkiStatus={rpkiStatus} />
                </a>
              </span>
            ))}
          </div>
        );
      })}

      {/* Status Icon Cell */}
      {reducedColour && (
        <div style={{ flex: '0 0 50px', padding: '8px', textAlign: 'center' }} className="lead">
          <FontAwesomeIcon icon={icons[categoryOverall]} title={`Status: ${categoryOverall}`} />
        </div>
      )}

      {/* Messages Cell */}
      <div style={{ flex: '1', padding: '8px', minWidth: '200px' }}>
        {safeMessages.map(({ category, text }) => (
          <MessageBadge key={text} category={category} text={text} reducedColour={reducedColour} />
        ))}
      </div>
    </div>
  );
}

export default memo(VirtualPrefixTableRow, (prevProps, nextProps) => {
  // Only re-render if the row data actually changed
  return prevProps.data.data[prevProps.index] === nextProps.data.data[nextProps.index];
});
