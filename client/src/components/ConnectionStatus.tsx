import { ConnectionInfo } from '../hooks/useRobotConnection';

export function ConnectionStatus({ info }: { info: ConnectionInfo }) {
  const dotClass =
    info.status === 'open' && !info.isStale
      ? 'status-dot status-dot--good'
      : info.status === 'connecting' || info.status === 'reconnecting'
        ? 'status-dot status-dot--warn'
        : 'status-dot status-dot--bad';

  const label =
    info.status === 'open' && info.isStale
      ? 'Connection stale — no data recently'
      : info.status === 'open'
        ? 'Connected'
        : info.status === 'reconnecting'
          ? 'Reconnecting…'
          : info.status === 'connecting'
            ? 'Connecting…'
            : 'Disconnected';

  return (
    <div className="connection-status" role="status">
      <span className={dotClass} aria-hidden="true" />
      <span>{label}</span>
      {info.rttMs !== null && <span className="connection-detail">RTT {info.rttMs}ms</span>}
      {info.networkPreset && <span className="connection-detail">link: {info.networkPreset}</span>}
      {info.tickRateHz && <span className="connection-detail">{info.tickRateHz}Hz</span>}
    </div>
  );
}
