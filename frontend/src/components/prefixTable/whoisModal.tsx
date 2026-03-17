import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import config from '../../config.json';
import type { RPKIStatus } from '../../types';

interface WhoisModalProps {}

export interface WhoisModalHandle {
  openWithContent: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => void;
}

const WhoisModal = forwardRef<WhoisModalHandle, WhoisModalProps>((_, ref) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const bootstrapModalRef = useRef<bootstrap.Modal | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const queryRef = useRef<HTMLParagraphElement>(null);
  const queryUrlRef = useRef<HTMLAnchorElement>(null);
  const rpslTextRef = useRef<HTMLPreElement>(null);
  const rpkiAlertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalRef.current) {
      bootstrapModalRef.current = new window.bootstrap.Modal(modalRef.current);
    }
    return () => {
      bootstrapModalRef.current?.dispose();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    openWithContent: (prefix: string, asn: number, sourceName: string, rpslText: string, rpkiStatus: RPKIStatus) => {
      const whoisServer = (config.whoisServers as Record<string, string>)[sourceName];
      const whoisUrl = (config.whoisUrls as Record<string, string>)[sourceName];

      if (titleRef.current) titleRef.current.innerText = `AS${asn} / ${prefix}`;
      if (queryRef.current) queryRef.current.innerText = `whois -h ${whoisServer} ${prefix}`;

      if (queryUrlRef.current) {
        if (whoisUrl) {
          queryUrlRef.current.innerText = `Open this object on the ${sourceName} website`;
          queryUrlRef.current.href = whoisUrl.replace('SEARCHPLACEHOLDER', `${prefix}AS${asn}`);
          queryUrlRef.current.hidden = false;
        } else {
          queryUrlRef.current.hidden = true;
        }
      }

      if (rpslTextRef.current) rpslTextRef.current.innerText = rpslText;
      if (rpkiAlertRef.current) rpkiAlertRef.current.hidden = rpkiStatus !== 'invalid';

      bootstrapModalRef.current?.show();
    },
  }));

  return (
    <div className="modal fade" tabIndex={-1} ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" ref={titleRef}>
              Modal title
            </h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
          </div>
          <div className="modal-body">
            <p className="font-monospace" ref={queryRef} />
            <pre className="text-light bg-dark" ref={rpslTextRef} />
            <p>The object shown below is mirrored, and may be modified or slightly outdated.</p>
            <p>
              <a className="btn btn-success" href="/" ref={queryUrlRef}>
                #
              </a>
              <br />
            </p>
            <div className="alert alert-warning" role="alert" ref={rpkiAlertRef}>
              This route object is RPKI-invalid, and may be filtered out of whois query output by default.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

WhoisModal.displayName = 'WhoisModal';

export default WhoisModal;
