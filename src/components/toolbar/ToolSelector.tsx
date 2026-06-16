/** Left vertical tool rail + AI and library launchers. */
import { TOOLS } from '../../constants';
import { useToolStore } from '../../store/toolStore';
import { useAIStore } from '../../store/aiStore';
import { useShapeLibraryStore } from '../../store/shapeLibraryStore';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

export function ToolSelector() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const aiOpen = useAIStore((s) => s.isOpen);
  const toggleAI = useAIStore((s) => s.toggleOpen);
  const libraryOpen = useShapeLibraryStore((s) => s.isOpen);
  const toggleLibrary = useShapeLibraryStore((s) => s.toggleOpen);

  return (
    <div className="panel pointer-events-auto flex flex-col items-center gap-0.5 p-1.5">
      {TOOLS.map((tool) => (
        <IconButton
          key={tool.id}
          label={tool.label}
          shortcut={tool.shortcut}
          active={activeTool === tool.id}
          tooltipSide="right"
          onClick={() => setActiveTool(tool.id)}
        >
          <Icon name={tool.id as IconName} size={17} />
        </IconButton>
      ))}
      <div className="my-1 h-px w-6 bg-black/[0.07] dark:bg-white/[0.08]" />
      <IconButton label="AI draw" active={aiOpen} tooltipSide="right" onClick={toggleAI}>
        <Icon name="sparkles" size={17} className={aiOpen ? '' : 'text-indigo-500'} />
      </IconButton>
      <IconButton label="Shape library" active={libraryOpen} tooltipSide="right" onClick={toggleLibrary}>
        <Icon name="library" size={17} />
      </IconButton>
    </div>
  );
}
