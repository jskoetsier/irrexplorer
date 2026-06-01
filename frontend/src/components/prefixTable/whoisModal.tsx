import { useState, useImperativeHandle, forwardRef } from 'react';
import config from '../../config.json';
import type { RPKIStatus } from '../../types';

interface WhoisModalProps {}

export interface WhoisModalHandle {
  openWithContent: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => void;
}

const WhoisModal = forwardRef<WhoisModalHandle, WhoisModalProps>((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    query: string;
    whoisUrl: string | null;
    sourceName: string;
    rpslText: string;
    isRpkiInvalid: boolean;
  }>({
    title: '',
    query: '',
    whoisUrl: null,
    sourceName: '',
    rpslText: '',
    isRpkiInvalid: false,
  });

  useImperativeHandle(ref, () => ({
    openWithContent: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => {
      const whoisServer = (config.whoisServers as Record<string, string>)[sourceName];
      const whoisUrl = (config.whoisUrls as Record<string, string>)[sourceName];

      const resolvedWhoisUrl = whoisUrl
        ? whoisUrl.replace('SEARCHPLACEHOLDER', `${prefix}AS${asn}`)
        : null;

      setModalData({
        title: `AS${asn} / ${prefix}`,
        query: `whois -h ${whoisServer} ${prefix}`,
        whoisUrl: resolvedWhoisUrl,
        sourceName,
        rpslText,
        isRpkiInvalid: rpkiStatus === 'INVALID',
      });
      setIsOpen(true);
    },
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      ></div>

      {/* Modal Box */}
      <div className="relative w-full max-w-3xl mx-4 my-6 z-50 animate-in zoom-in-95 duration-150">
        <div className="relative flex flex-col w-full bg-[#1e2024] border border-[#3d4a3d]/40 rounded-xl shadow-2xl overflow-hidden text-[#e2e2e8]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#3d4a3d]/20 bg-[#1e2024]">
            <h3 className="font-headline-md text-base font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">terminal</span>
              {modalData.title}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant hover:text-on-surface p-1 hover:bg-[#333539]/30 rounded transition-all flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="relative p-6 flex-auto max-h-[65vh] overflow-y-auto space-y-md font-body-sm text-xs leading-relaxed text-on-surface-variant">
            {/* Terminal Command well */}
            <div className="bg-[#0a0c0f] border border-[#3d4a3d]/20 p-3 rounded font-data-mono text-[#4ae176]/90 select-text flex items-center gap-2">
              <span className="text-on-surface-variant/40 shrink-0">$</span>
              <span>{modalData.query}</span>
            </div>

            {/* Raw RPSL text panel */}
            <div className="bg-[#0a0c0f] border border-[#3d4a3d]/30 rounded p-4 font-data-mono text-[11px] overflow-x-auto whitespace-pre-wrap select-text text-primary/80 max-h-[300px]">
              {modalData.rpslText}
            </div>

            <p className="italic text-on-surface-variant/60 bg-[#111317] p-2.5 rounded border border-[#3d4a3d]/10">
              Note: The object shown above is mirrored and might be slightly outdated or modified.
            </p>

            {modalData.whoisUrl && (
              <div>
                <a
                  href={modalData.whoisUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#22c55e] hover:bg-[#4ae176] text-[#002109] font-label-caps text-xs font-bold rounded-lg transition-colors uppercase tracking-wider shadow-lg shadow-[#22c55e]/5"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  <span>View on {modalData.sourceName} Website</span>
                </a>
              </div>
            )}

            {modalData.isRpkiInvalid && (
              <div className="bg-red-950/20 border-l-4 border-red-500 p-4 rounded-r text-red-400 font-semibold" role="alert">
                Warning: This route object is RPKI-invalid and may be filtered out of query output by default by major upstreams.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-3 border-t border-[#3d4a3d]/20 bg-[#1e2024]/40">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-[#3d4a3d]/30 hover:bg-[#333539]/30 rounded-lg text-xs font-label-caps font-bold text-on-surface uppercase tracking-wider transition-colors"
            >
              Close Console
            </button>
          </div>

        </div>
      </div>
    </div>
  );
});

WhoisModal.displayName = 'WhoisModal';

export default WhoisModal;
