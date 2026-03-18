import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle } from '@fortawesome/free-regular-svg-icons';
import type { RPKIStatus } from '../../types';

interface AsnWithRPKIStatusProps {
  rpkiStatus?: RPKIStatus;
  asn: number;
}

export default function AsnWithRPKIStatus({ rpkiStatus, asn }: AsnWithRPKIStatusProps) {
  let rpkiIcon: typeof faCheckCircle | undefined;
  let text = '';
  let asnClass = '';

  if (rpkiStatus === 'VALID') {
    rpkiIcon = faCheckCircle;
    text = 'Route object is RPKI-valid';
  } else if (rpkiStatus === 'INVALID') {
    rpkiIcon = faTimesCircle;
    text = 'Route object is RPKI-invalid';
    asnClass = 'text-decoration-line-through';
  }

  return (
    <span className="nowrap">
      <span className={asnClass}>{asn}</span>
      {rpkiIcon && (
        <>
          {' '}
          <span className="d-inline-block" data-bs-toggle="tooltip" title={text}>
            <FontAwesomeIcon icon={rpkiIcon} title={text} />
          </span>
        </>
      )}
    </span>
  );
}
