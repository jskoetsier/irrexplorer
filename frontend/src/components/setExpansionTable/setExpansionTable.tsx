import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Spinner from '../common/spinner';
import { Link } from 'react-router-dom';
import TableFooter from '../common/tableFooter';

interface SetExpansionTableProps {
  query: string;
  objectClass: 'as-set' | 'route-set';
}

interface SubSet {
  name: string;
  source: string;
  depth: number;
  path: string[];
  members: string[];
}

export default function SetExpansionTable({ query, objectClass }: SetExpansionTableProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [subSets, setSubSets] = useState<SubSet[]>([]);
  const [apiCallUrl, setApiCallUrl] = useState('');

  const load = useCallback(async () => {
    setHasLoaded(false);
    setSubSets([]);
    setApiCallUrl('');

    const { data, url } = await api.getSetExpansion(query);
    if (data) {
      setHasLoaded(true);
      setSubSets(Array.isArray(data) ? data : []);
      setApiCallUrl(url || '');
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const renderTablePlaceholder = (placeholder: React.ReactNode) => (
    <tbody>
      <tr>
        <td colSpan={4} className="text-center">
          {placeholder}
        </td>
      </tr>
    </tbody>
  );

  const renderTableContent = () => {
    if (!hasLoaded) return renderTablePlaceholder(<Spinner />);
    if (!subSets.length) return renderTablePlaceholder(`${objectClass} was not found.`);

    return (
      <>
        <thead>
          <tr>
            <th>Name</th>
            <th>Source</th>
            <th>Depth</th>
            <th>Path</th>
            <th>Members</th>
          </tr>
        </thead>
        <tbody>
          {subSets.map(({ name, source, depth, path, members }) => (
            <tr key={name + path.join()}>
              <td>
                <Link to={`/${objectClass}/${name}`}>{name}</Link>
              </td>
              <td>{source}</td>
              <td>{depth}</td>
              <td>{path.join(' ➜ ')}</td>
              <td>
                {members.map((member, idx) => (
                  <span key={idx}>
                    <Link to={`/query/${member}`}>{member}</Link>{' '}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
        <TableFooter url={apiCallUrl} />
      </>
    );
  };

  return (
    <div className="table-responsive">
      <table className="table mb-5 table-fixed table-striped">
        <caption>Expansion depth is limited beyond 1000 total {objectClass}s.</caption>
        {renderTableContent()}
      </table>
    </div>
  );
}
