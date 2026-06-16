/** Align / distribute bar — appears with 2+ selected elements. */
import type { AlignType, DistributeAxis } from '../../types';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { historyActions } from '../../hooks/useHistory';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

const ALIGNS: { type: AlignType; icon: IconName; label: string }[] = [
  { type: 'left', icon: 'alignLeft', label: 'Align left' },
  { type: 'centerX', icon: 'alignCenterX', label: 'Align horizontal centers' },
  { type: 'right', icon: 'alignRight', label: 'Align right' },
];
const ALIGNS_Y: { type: AlignType; icon: IconName; label: string }[] = [
  { type: 'top', icon: 'alignTop', label: 'Align top' },
  { type: 'centerY', icon: 'alignCenterY', label: 'Align vertical centers' },
  { type: 'bottom', icon: 'alignBottom', label: 'Align bottom' },
];

export function AlignBar() {
  const selectedIds = useToolStore((s) => s.selectedIds);
  if (selectedIds.length < 2) return null;

  const align = (type: AlignType) => {
    historyActions.saveSnapshot();
    useElementStore.getState().alignElements(selectedIds, type);
  };
  const distribute = (axis: DistributeAxis) => {
    historyActions.saveSnapshot();
    useElementStore.getState().distributeElements(selectedIds, axis);
  };

  return (
    <div className="panel animate-in pointer-events-auto flex items-center gap-0.5 px-1.5 py-1">
      {ALIGNS.map((a) => (
        <IconButton key={a.type} label={a.label} onClick={() => align(a.type)}>
          <Icon name={a.icon} size={15} />
        </IconButton>
      ))}
      <div className="toolbar-divider" />
      {ALIGNS_Y.map((a) => (
        <IconButton key={a.type} label={a.label} onClick={() => align(a.type)}>
          <Icon name={a.icon} size={15} />
        </IconButton>
      ))}
      {selectedIds.length >= 3 && (
        <>
          <div className="toolbar-divider" />
          <IconButton label="Distribute horizontally" onClick={() => distribute('horizontal')}>
            <Icon name="distributeH" size={15} />
          </IconButton>
          <IconButton label="Distribute vertically" onClick={() => distribute('vertical')}>
            <Icon name="distributeV" size={15} />
          </IconButton>
        </>
      )}
    </div>
  );
}
