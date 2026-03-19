import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight, faCheckCircle, faExclamationCircle, faQuestionCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
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

const icons: Record<MessageCategory, typeof faCheckCircle> = {
  danger: faTimesCircle,
  warning: faExclamationCircle,
  info: faQuestionCircle,
  success: faCheckCircle,
};

export default function PrefixTableBody({
  irrSourceColumns,
  prefixesData,
  reducedColour,
  filterWarningError,
  handleIrrRouteSelect,
}: PrefixTableBodyProps) {
  const renderSourceCell = (prefix: string, irrRoutes: PrefixData['irrRoutes'], sourceName: string) => {
    const routesForSource = irrRoutes[sourceName];
    if (!routesForSource) return <td key={sourceName} />;
    return (
      <td key={sourceName}>
        {routesForSource.map(({ asn, rpkiStatus, rpslText }, idx) => [
          idx > 0 && ', ',
          <a
            className="link-dark"
            key={`${asn}-${idx}`}
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleIrrRouteSelect(prefix, asn, sourceName, rpslText, rpkiStatus);
            }}
          >
            <AsnWithRPKIStatus asn={asn} rpkiStatus={rpkiStatus} />
          </a>,
        ])}
      </td>
    );
  };

  const renderRpkiCells = (rpkiRoutes: PrefixData['rpkiRoutes']) => {
    return (
      <td key="rpkiRoutes" className="mono">
        {rpkiRoutes.map(({ asn, rpkiMaxLength }, idx) => [
          idx > 0 && ', ',
          asn,
          ' ',
          <span key={`${asn}-${idx}`} className="small">
            <FontAwesomeIcon aria-label="max length" icon={faCaretRight} />/{rpkiMaxLength}
          </span>,
        ])}
      </td>
    );
  };

  const classNameForRow = (categoryOverall: MessageCategory) => {
    return reducedColour ? '' : `table-${categoryOverall}`;
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
        <tr key="nodata">
          <td key="nodata" colSpan={100}>
            No records with an error or warning status.
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {tableData.map(({ prefix, categoryOverall, rir, bgpOrigins, rpkiRoutes, irrRoutes, messages }) => {
        const safeBgpOrigins = bgpOrigins ?? [];
        const safeRpkiRoutes = rpkiRoutes ?? [];
        const safeIrrRoutes = irrRoutes ?? {};
        const safeMessages = messages ?? [];
        return (
        <tr key={prefix} className={classNameForRow(categoryOverall)}>
          <td key="prefix">
            <Link to={`/prefix/${prefix}`} className="link-dark">
              {prefix}
            </Link>
          </td>
          <td key="rir" className="nowrap">
            {rir}
          </td>
          <td key="bgpOrigins">
            <a href={`https://lg.ring.nlnog.net/prefix?q=${prefix}&match=exact&peer=all`} className="link-dark">
              {safeBgpOrigins.join(', ')}
            </a>
          </td>
          {renderRpkiCells(safeRpkiRoutes)}
          {irrSourceColumns.map((sourceName) => renderSourceCell(prefix, safeIrrRoutes, sourceName))}
          {reducedColour && (
            <td key="adviceIcon" className="lead">
              <FontAwesomeIcon icon={icons[categoryOverall]} title={`Status: ${categoryOverall}`} />
            </td>
          )}
          <td key="messages">
            {safeMessages.map(({ category, text }) => (
              <MessageBadge key={text} category={category} text={text} reducedColour={reducedColour} />
            ))}
          </td>
        </tr>
        );
      })}
    </tbody>
  );
}
