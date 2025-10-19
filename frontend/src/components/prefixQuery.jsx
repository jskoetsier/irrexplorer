import React, {Component} from 'react';
import PropTypes from 'prop-types';
import PrefixTableExplanation from "./prefixTable/prefixTableExplanation";
import PrefixTable from "./prefixTable/prefixTable";
import {findLeastSpecific} from "../utils/prefixData";
import api from "../services/api";
import DataSourcesModal from "./dataSources/DataSourcesModal";

class PrefixQuery extends Component {
    state = {
        leastSpecificPrefix: null,
        directOverlapPrefixes: {hasLoaded: false, data: [], apiCallUrl: ''},
        leastSpecificOverlapPrefixes: {hasLoaded: false, data: [], apiCallUrl: ''},
        showDataSources: false,
    };

    async componentDidMount() {
        await this.loadPrefixesData();
    }

    async componentDidUpdate(prevProps) {
        if (prevProps.query !== this.props.query) {
            await this.loadPrefixesData();
        }
    }

    async loadPrefixesData() {
        this.setState({
            leastSpecificPrefix: null,
            directOverlapPrefixes: {hasLoaded: false, data: [], apiCallUrl: ''},
            leastSpecificOverlapPrefixes: {hasLoaded: false, data: [], apiCallUrl: ''},
        });
        await this.loadPrefixData(this.props.query, 'directOverlapPrefixes');
        const leastSpecificPrefix = findLeastSpecific(this.props.query, this.state.directOverlapPrefixes.data);
        this.setState({
            leastSpecificPrefix: leastSpecificPrefix,
        })
        if (leastSpecificPrefix) {
            await this.loadPrefixData(leastSpecificPrefix, 'leastSpecificOverlapPrefixes');
        }
    }

    async loadPrefixData(query, target) {
        const {data, url} = await api.getPrefixesForPrefix(query);
        this.setState({
            [target]: {hasLoaded: true, data, apiCallUrl: url},
        })
    }

    render() {
        const {query, reducedColour, filterWarningError} = this.props;
        const {leastSpecificOverlapPrefixes, directOverlapPrefixes, leastSpecificPrefix, showDataSources} = this.state;
        return (
            <>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h1>Report for prefix {query}</h1>
                    <button
                        className="btn btn-primary"
                        onClick={() => this.setState({showDataSources: true})}
                        style={{height: 'fit-content'}}
                    >
                        <i className="fas fa-external-link-alt"></i> External Data Sources
                    </button>
                </div>
                <PrefixTableExplanation/>
                <h2 className="h3 mt-4">
                    Directly overlapping prefixes of {query}
                </h2>
                <hr/>
                <PrefixTable
                    prefixesData={directOverlapPrefixes.data}
                    hasLoaded={directOverlapPrefixes.hasLoaded}
                    apiCallUrl={directOverlapPrefixes.apiCallUrl}
                    reducedColour={reducedColour}
                    filterWarningError={filterWarningError}
                />

                {leastSpecificPrefix && <>
                    <h2 className="h3 mt-4">
                        All overlaps of least specific match {leastSpecificPrefix}
                    </h2>
                    <hr/>
                    <PrefixTable
                        prefixesData={leastSpecificOverlapPrefixes.data}
                        hasLoaded={leastSpecificOverlapPrefixes.hasLoaded}
                        apiCallUrl={leastSpecificOverlapPrefixes.apiCallUrl}
                        reducedColour={reducedColour}
                        filterWarningError={filterWarningError}
                        defaultSortSmallestFirst={true}
                    />
                </>}

                {showDataSources && (
                    <DataSourcesModal
                        query={query}
                        type="prefix"
                        onClose={() => this.setState({showDataSources: false})}
                    />
                )}
            </>
        );
    }
}

PrefixQuery.propTypes = {
    query: PropTypes.string.isRequired,
    reducedColour: PropTypes.bool,
    filterWarningError: PropTypes.bool,
};

export default PrefixQuery;
