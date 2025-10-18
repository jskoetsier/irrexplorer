import React, {useMemo, useRef, useState, useCallback} from 'react';
import PropTypes from 'prop-types';

import Spinner from "../common/spinner";
import PrefixTableBody from "./prefixTableBody";
import {findIrrSourceColumns, sortPrefixesDataBy} from "../../utils/prefixData";
import PrefixTableHeader from "./prefixTableHeader";
import WhoisModal from "./whoisModal";
import TableFooter from "../common/tableFooter";


function PrefixTable(props) {
    const {prefixesData, hasLoaded, reducedColour, filterWarningError, apiCallUrl, defaultSortSmallestFirst} = props;

    const whoisModalRef = useRef();
    const [sortKey, setSortKey] = useState(defaultSortSmallestFirst ? 'prefixSmallestFirst' : 'prefix');
    const [sortOrder, setSortOrder] = useState('asc');

    // Memoize IRR source columns calculation to avoid recalculating on every render
    const irrSourceColumns = useMemo(() => {
        return findIrrSourceColumns(prefixesData);
    }, [prefixesData]);

    // Memoize sorted data to avoid redundant sorting operations
    const sortedPrefixesData = useMemo(() => {
        return sortPrefixesDataBy(prefixesData, sortKey, sortOrder);
    }, [prefixesData, sortKey, sortOrder]);

    const handleSort = useCallback(({key, order}) => {
        setSortKey(key);
        setSortOrder(order);
    }, []);

    const handleIrrRouteSelect = useCallback((prefix, asn, sourceName, rpslText, rpkiStatus) => {
        whoisModalRef.current.openWithContent(prefix, asn, sourceName, rpslText, rpkiStatus);
    }, []);

    const renderTablePlaceholder = (placeholder) => {
        return (
            <tbody>
            <tr>
                <td colSpan="5" className="text-center">{placeholder}</td>
            </tr>
            </tbody>
        );
    };

    const renderTableContent = () => {
        if (!hasLoaded)
            return renderTablePlaceholder(<Spinner/>);
        if (!prefixesData.length)
            return renderTablePlaceholder("No prefixes were found or query was too large to execute.");
        return <PrefixTableBody
            irrSourceColumns={irrSourceColumns}
            prefixesData={sortedPrefixesData}
            reducedColour={reducedColour}
            filterWarningError={filterWarningError}
            handleIrrRouteSelect={handleIrrRouteSelect}
        />
    };

    return (
        <>
            <table className="table table-sm mb-5 table-fixed table-striped">
                <PrefixTableHeader
                    irrSourceColumns={irrSourceColumns}
                    onSort={handleSort}
                    reducedColour={reducedColour}
                />
                {renderTableContent()}
                <TableFooter url={apiCallUrl} />
            </table>
            <WhoisModal ref={whoisModalRef}/>
        </>
    );
}

PrefixTable.propTypes = {
    prefixesData: PropTypes.arrayOf(PropTypes.object).isRequired,
    hasLoaded: PropTypes.bool,
    reducedColour: PropTypes.bool,
    filterWarningError: PropTypes.bool,
    apiCallUrl: PropTypes.string,
    defaultSortSmallestFirst: PropTypes.bool,
};


export default PrefixTable;
