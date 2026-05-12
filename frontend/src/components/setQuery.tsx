import SetIncludedTable from './common/setIncludedTable';
import SetExpansionTable from './setExpansionTable/setExpansionTable';
import type { QueryCategory } from '../types';

interface SetQueryProps {
  query: string;
  queryCategory: QueryCategory;
}

export default function SetQuery({ query, queryCategory }: SetQueryProps) {
  const objectClass = (queryCategory === 'as-set' || queryCategory === 'route-set') ? queryCategory : 'as-set';

  return (
    <>
      <h1>Report for {queryCategory} {query}</h1>

      <h2 className="h3 mt-4">Expands to:</h2>
      <hr />
      <SetExpansionTable query={query} objectClass={objectClass} />
      <h2 className="h3 mt-4">Included in the following sets:</h2>
      <hr />
      <SetIncludedTable query={query} objectClass={objectClass} />
    </>
  );
}
