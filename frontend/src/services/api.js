import axios from "axios";

let source = axios.CancelToken.source();

let apiUrl = process.env.REACT_APP_BACKEND
if (!apiUrl) {
    apiUrl = window.location.origin + "/api";
}

// Default headers for requests - allow selective caching per endpoint
axios.defaults.headers.common = {
    'Accept': 'application/json',
};

axios.interceptors.response.use(null, error => {
    const expectedError =
        error.message === 'cancel' ||
        (error.response &&
            error.response.status >= 400 &&
            error.response.status < 500);
    if (!expectedError) {
        console.log('Unexpected HTTP error', error);
    }
    return Promise.reject(error);
})


export async function getMetadata() {
    try {
        const url = `${apiUrl}/metadata/`
        const response = await axios.get(url);
        return {data: response.data, url: url};
    } catch (exc) {
        if (exc.response) {
            return {error: 'Error: unable to reach API: ' + exc.response.data}
        }
        return {error: 'Error: unable to reach API'}
    }
}

export async function cleanQuery(query) {
    try {
        const response = await axios.get(`${apiUrl}/clean_query/${query}`);
        return response.data;
    } catch (exc) {
        if (exc.response) {
            return {error: 'Error: unable to reach API: ' + exc.response.data}
        }
        return {error: 'Error: unable to reach API'}
    }
}

async function performRequest(url) {
    try {
        const response = await axios.get(url, {cancelToken: source.token});
        return {data: response.data, url: url};
    } catch (exc) {
        return {data: null, url: url};
    }

}

export async function getPrefixesForPrefix(prefix) {
    return await performRequest(`${apiUrl}/prefixes/prefix/${prefix}`);
}

export async function getPrefixesForASN(asn) {
    return await performRequest(`${apiUrl}/prefixes/asn/${asn}`);
}

export async function getSetMemberOf(target, object_class) {
    return await performRequest(`${apiUrl}/sets/member-of/${object_class}/${target}`);
}

export async function getSetExpansion(target) {
    return await performRequest(`${apiUrl}/sets/expand/${target}`);
}

export async function cancelAllRequests() {
    await source.cancel('cancel');
    source = axios.CancelToken.source();
}

export async function autocomplete(query, limit = 10) {
    try {
        const response = await axios.get(`${apiUrl}/autocomplete/${query}?limit=${limit}`);
        return {data: response.data, url: `${apiUrl}/autocomplete/${query}`};
    } catch (exc) {
        return {data: null, url: null};
    }
}

export async function addSearchHistory(query, queryType) {
    try {
        await axios.post(`${apiUrl}/search-history`, {query, query_type: queryType});
    } catch (exc) {
        console.error('Failed to add search history', exc);
    }
}

export async function getSearchHistory(limit = 20) {
    try {
        const response = await axios.get(`${apiUrl}/search-history?limit=${limit}`);
        return {data: response.data, url: `${apiUrl}/search-history`};
    } catch (exc) {
        return {data: null, url: null};
    }
}

export async function clearSearchHistory() {
    try {
        await axios.delete(`${apiUrl}/search-history/clear`);
        return {success: true};
    } catch (exc) {
        return {success: false};
    }
}

export async function addBookmark(query, queryType, name = '') {
    try {
        await axios.post(`${apiUrl}/bookmarks`, {query, query_type: queryType, name});
        return {success: true};
    } catch (exc) {
        return {success: false, error: exc.response?.data?.error || 'Failed to add bookmark'};
    }
}

export async function getBookmarks() {
    try {
        const response = await axios.get(`${apiUrl}/bookmarks`);
        return {data: response.data, url: `${apiUrl}/bookmarks`};
    } catch (exc) {
        return {data: null, url: null};
    }
}

export async function deleteBookmark(bookmarkId) {
    try {
        await axios.delete(`${apiUrl}/bookmarks/${bookmarkId}`);
        return {success: true};
    } catch (exc) {
        return {success: false};
    }
}

export async function getPopularQueries(limit = 10, days = 7) {
    try {
        const response = await axios.get(`${apiUrl}/popular?limit=${limit}&days=${days}`);
        return {data: response.data, url: `${apiUrl}/popular`};
    } catch (exc) {
        return {data: null, url: null};
    }
}

export async function getTrendingQueries(limit = 10) {
    try {
        const response = await axios.get(`${apiUrl}/trending?limit=${limit}`);
        return {data: response.data, url: `${apiUrl}/trending`};
    } catch (exc) {
        return {data: null, url: null};
    }
}

export async function advancedSearch(query, filters = {}) {
    try {
        const params = new URLSearchParams({q: query});
        if (filters.type && filters.type !== 'all') params.append('type', filters.type);
        if (filters.status && filters.status !== 'all') params.append('status', filters.status);
        if (filters.search) params.append('search', filters.search);

        const response = await axios.get(`${apiUrl}/advanced-search?${params.toString()}`);
        return {data: response.data, url: `${apiUrl}/advanced-search`};
    } catch (exc) {
        return {data: null, url: null, error: exc.response?.data?.error || 'Search failed'};
    }
}

export async function getFilterOptions() {
    try {
        const response = await axios.get(`${apiUrl}/filter-options`);
        return {data: response.data, url: `${apiUrl}/filter-options`};
    } catch (exc) {
        return {data: null, url: null};
    }
}

const api = {
    getMetadata,
    getPrefixesForPrefix,
    getPrefixesForASN,
    cleanQuery,
    getSetMemberOf,
    getSetExpansion,
    cancelAllRequests,
    autocomplete,
    addSearchHistory,
    getSearchHistory,
    clearSearchHistory,
    addBookmark,
    getBookmarks,
    deleteBookmark,
    getPopularQueries,
    getTrendingQueries,
}
export default api;
