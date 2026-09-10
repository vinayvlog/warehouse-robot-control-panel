import { RobotState } from '../lib/robotSimulator';

const VIEW_SIZE = 400;
const SCALE = 30; // px per world unit

export function RobotCanvas({ state }: { state: RobotState }) {
  const cx = VIEW_SIZE / 2 + state.x * SCALE;
  const cy = VIEW_SIZE / 2 + state.y * SCALE;
  const heading = state.heading;

  const noseX = cx + Math.cos(heading) * 18;
  const noseY = cy + Math.sin(heading) * 18;

  const gridLines = [];
  for (let i = -10; i <= 10; i++) {
    const pos = VIEW_SIZE / 2 + i * SCALE;
    gridLines.push(<line key={`v${i}`} x1={pos} y1={0} x2={pos} y2={VIEW_SIZE} className="grid-line" />);
    gridLines.push(<line key={`h${i}`} x1={0} y1={pos} x2={VIEW_SIZE} y2={pos} className="grid-line" />);
  }

  return (
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="robot-canvas" role="img" aria-label="Robot position">
      {gridLines}
      <circle cx={cx} cy={cy} r={14} className="robot-body" />
      <line x1={cx} y1={cy} x2={noseX} y2={noseY} className="robot-heading" />
    </svg>
  );
}
