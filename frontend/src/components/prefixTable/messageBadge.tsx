import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faQuestionCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import type { MessageCategory } from '../../types';

interface MessageBadgeProps {
  category: MessageCategory;
  text: string;
  reducedColour?: boolean;
}

export default function MessageBadge({ category, text, reducedColour }: MessageBadgeProps) {
  let classes = '';
  if (!reducedColour) {
    classes = `badge bg-${category} `;
    if (category === 'warning' || category === 'info') classes += 'text-dark ';
  }

  const icons = {
    danger: faTimesCircle,
    warning: faExclamationCircle,
    info: faQuestionCircle,
    success: faCheckCircle,
  };

  return (
    <>
      <span className={classes}>
        <FontAwesomeIcon icon={icons[category]} title={category} /> {text}
      </span>
      <br />
    </>
  );
}
