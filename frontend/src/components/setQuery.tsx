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
    <div className="space-y-lg animate-in fade-in duration-300">
      {/* Expands to Card */}
      <section className="bg-[#1a1c20] border border-[#3d4a3d]/30 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-lg py-md border-b border-[#3d4a3d]/20 flex justify-between items-center bg-[#1e2024]/80">
          <h2 className="font-headline-md text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">account_tree</span>
            Expansion Hierarchy Nodes
          </h2>
        </div>
        <div className="p-md bg-[#0f1115]/50">
          <SetExpansionTable query={query} objectClass={objectClass} />
        </div>
      </section>

      {/* Included in sets Card */}
      <section className="bg-[#1a1c20] border border-[#3d4a3d]/30 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-lg py-md border-b border-[#3d4a3d]/20 flex justify-between items-center bg-[#1e2024]/80">
          <h2 className="font-headline-md text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">hub</span>
            Parent set inclusions for {query}
          </h2>
        </div>
        <div className="p-md bg-[#0f1115]/50">
          <SetIncludedTable query={query} objectClass={objectClass} />
        </div>
      </section>
    </div>
  );
}
