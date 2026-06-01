import { useState } from 'react';

export default function PrefixTableExplanation() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="space-y-sm bg-[#1a1c20]/60 border border-[#3d4a3d]/20 rounded-xl p-md">
      {/* Section 1 */}
      <div className="border border-[#3d4a3d]/10 rounded-lg overflow-hidden bg-[#1e2024]/40">
        <button
          type="button"
          onClick={() => toggleSection('columns')}
          className="w-full flex justify-between items-center px-4 py-3 text-left font-label-caps text-xs font-bold text-on-surface hover:bg-[#333539]/30 transition-all select-none uppercase tracking-wider"
        >
          <span>What does the prefix table show?</span>
          <span className={`material-symbols-outlined text-lg text-primary transition-transform duration-200 ${openSection === 'columns' ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
        
        {openSection === 'columns' && (
          <div className="px-4 py-4 border-t border-[#3d4a3d]/10 space-y-md text-xs text-on-surface-variant font-body-sm leading-relaxed animate-in fade-in duration-200">
            <p className="font-semibold text-on-surface">
              The table shows prefixes relating to your query. It presents overlapping and direct allocations in a structured format:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md font-data-mono">
              <div className="bg-[#111317] p-3 rounded border border-[#3d4a3d]/10">
                <span className="text-primary font-bold block mb-1">PREFIX</span>
                <span>The prefix found in either BGP, RPKI or IRR.</span>
              </div>
              <div className="bg-[#111317] p-3 rounded border border-[#3d4a3d]/10">
                <span className="text-primary font-bold block mb-1">RIR</span>
                <span>The authoritative regional internet registry that allocated this block.</span>
              </div>
              <div className="bg-[#111317] p-3 rounded border border-[#3d4a3d]/10">
                <span className="text-primary font-bold block mb-1">BGP ORIGINS</span>
                <span>The originating AS number(s) seen in the Default Free Zone (DFZ).</span>
              </div>
              <div className="bg-[#111317] p-3 rounded border border-[#3d4a3d]/10">
                <span className="text-primary font-bold block mb-1">RPKI ROAs</span>
                <span>Cryptographically verified origins in active ROAs, plus maximum length restrictions.</span>
              </div>
            </div>
            <p className="text-[11px] bg-primary/5 border border-primary/20 p-2.5 rounded text-primary/80">
              Note: An IRR origin is evaluated against covering ROAs. If a covering ROA (e.g. /22 maxlen 24) allows the specific announcement, the IRR record is marked as <strong>RPKI valid</strong> even if no direct ROA for the specific /24 exists.
            </p>
          </div>
        )}
      </div>

      {/* Section 2 */}
      <div className="border border-[#3d4a3d]/10 rounded-lg overflow-hidden bg-[#1e2024]/40">
        <button
          type="button"
          onClick={() => toggleSection('messages')}
          className="w-full flex justify-between items-center px-4 py-3 text-left font-label-caps text-xs font-bold text-on-surface hover:bg-[#333539]/30 transition-all select-none uppercase tracking-wider"
        >
          <span>Explanation of Routing Integrity Status Messages</span>
          <span className={`material-symbols-outlined text-lg text-primary transition-transform duration-200 ${openSection === 'messages' ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {openSection === 'messages' && (
          <div className="px-4 py-4 border-t border-[#3d4a3d]/10 space-y-3 text-xs text-on-surface-variant font-body-sm leading-relaxed animate-in fade-in duration-200">
            <div className="space-y-2">
              <div className="p-3 bg-red-950/20 border-l-4 border-red-500 rounded-r">
                <strong className="text-red-400 block mb-1">No route objects match DFZ origin</strong>
                <span>No matching IRR records exist. This causes route filtering by strict upstreams. You should register valid route objects.</span>
              </div>
              <div className="p-3 bg-red-950/20 border-l-4 border-red-500 rounded-r">
                <strong className="text-red-400 block mb-1">RPKI origin does not match BGP origin</strong>
                <span>The DFZ origin conflicts with cryptographically signed ROAs. Strict validators drop this route completely. Immediate remediation required.</span>
              </div>
              <div className="p-3 bg-amber-950/20 border-l-4 border-amber-500 rounded-r">
                <strong className="text-amber-400 block mb-1">Route objects exist, but prefix not seen in DFZ</strong>
                <span>Stale IRR objects are still active. If prefix is decomissioned, delete IRR objects to avoid route hijacking exposure.</span>
              </div>
              <div className="p-3 bg-amber-950/20 border-l-4 border-amber-500 rounded-r">
                <strong className="text-amber-400 block mb-1">RPKI-invalid route objects found</strong>
                <span>IRR records conflict with current ROAs. Update or clean up the obsolete IRR registration.</span>
              </div>
            </div>
            <p className="text-[11px] text-center pt-2">
              For comprehensive details on RPKI security practices, check the{' '}
              <a href="https://rpki.readthedocs.io/en/latest/rpki/securing-bgp.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">
                BGP Security Guide
              </a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
