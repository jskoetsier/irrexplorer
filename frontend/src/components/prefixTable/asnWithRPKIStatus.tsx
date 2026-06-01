import type { RPKIStatus } from '../../types';

interface AsnWithRPKIStatusProps {
  rpkiStatus?: RPKIStatus;
  asn: number;
}

export default function AsnWithRPKIStatus({ rpkiStatus, asn }: AsnWithRPKIStatusProps) {
  let badgeStyles = 'inline-flex items-center gap-1 font-semibold ';
  let iconName = '';
  let iconClass = '';
  let tooltipText = '';

  if (rpkiStatus === 'VALID') {
    badgeStyles += 'text-primary ';
    iconName = 'check_circle';
    iconClass = 'text-primary';
    tooltipText = 'Route object is RPKI-valid';
  } else if (rpkiStatus === 'INVALID') {
    badgeStyles += 'text-red-400 line-through ';
    iconName = 'cancel';
    iconClass = 'text-red-400';
    tooltipText = 'Route object is RPKI-invalid';
  } else {
    badgeStyles += 'text-on-surface-variant ';
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={tooltipText}>
      <span className={badgeStyles}>AS{asn}</span>
      {iconName && (
        <span className={`material-symbols-outlined text-[13px] leading-none ${iconClass}`}>
          {iconName}
        </span>
      )}
    </span>
  );
}
