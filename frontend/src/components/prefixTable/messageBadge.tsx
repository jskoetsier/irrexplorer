import type { MessageCategory } from '../../types';

interface MessageBadgeProps {
  category: MessageCategory;
  text: string;
  reducedColour?: boolean;
}

export default function MessageBadge({ category, text, reducedColour }: MessageBadgeProps) {
  let badgeStyles = 'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border ';

  if (reducedColour) {
    badgeStyles += 'bg-transparent border-transparent text-on-surface ';
  } else {
    switch (category) {
      case 'success':
        badgeStyles += 'bg-[#22c55e]/10 text-primary border-primary/20 ';
        break;
      case 'danger':
        badgeStyles += 'bg-red-950/20 text-red-400 border-red-900/30 ';
        break;
      case 'warning':
        badgeStyles += 'bg-[#ffb95f]/10 text-secondary border-[#ffb95f]/20 ';
        break;
      default:
        badgeStyles += 'bg-blue-950/20 text-blue-400 border-blue-900/30 ';
        break;
    }
  }

  const iconName = () => {
    switch (category) {
      case 'success':
        return 'check_circle';
      case 'danger':
        return 'cancel';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const textClass = () => {
    switch (category) {
      case 'success':
        return 'text-primary';
      case 'danger':
        return 'text-red-400';
      case 'warning':
        return 'text-secondary';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="mb-1">
      <span className={badgeStyles}>
        <span className={`material-symbols-outlined text-[13px] leading-none ${textClass()}`}>{iconName()}</span>
        <span>{text}</span>
      </span>
    </div>
  );
}
