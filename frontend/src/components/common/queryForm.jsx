import React, {useState} from 'react';
import {Link, navigate} from "@reach/router";

import api from "../../services/api";
import Spinner from "./spinner";
import Autocomplete from "./autocomplete";

function QueryForm() {
    const [search, setSearch] = useState('');
    const [validationError, setValidationError] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearchSubmit = async (event) => {
        await api.cancelAllRequests();
        event.preventDefault();
        if (!search) return;

        setIsSearching(true);
        const cleanResult = await api.cleanQuery(search);
        if (cleanResult.error) {
            setValidationError(cleanResult.error);
            setIsSearching(false);
        } else {
            await navigate(`/${cleanResult.category}/${cleanResult.cleanedValue}`);
        }
    }

    const handleSearchChange = (value) => {
        setValidationError('');
        setSearch(value);
    }

    const handleAutocompleteSelect = async (query, type) => {
        setSearch(query);
        setIsSearching(true);
        await navigate(`/${type}/${query}`);
    }

    let inputClasses = "form-control form-control-lg ";
    if (validationError)
        inputClasses += "is-invalid";

    return (
        <form className="row" onSubmit={handleSearchSubmit}>
            <div className="col-sm-10">
                <label className="visually-hidden" htmlFor="search">Search input</label>
                <div className="input-group has-validation">
                    <Autocomplete
                        value={search}
                        placeholder="Prefix, IP, ASN or AS/route-set"
                        onInputChange={handleSearchChange}
                        onSelect={handleAutocompleteSelect}
                    />
                    <div className="invalid-feedback">
                        {validationError}
                    </div>
                </div>
            </div>

            <div className="col-sm-2">
                <button type="submit" className="btn btn-success btn-lg" disabled={!search || isSearching}>
                    {isSearching ? <Spinner /> : 'Search'}
                </button>
            </div>
            {!isSearching && <Link to="/status/">Data source status</Link>}
        </form>
    );
}

export default QueryForm;
