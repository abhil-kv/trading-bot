import './ConnectionStatus.css';

export default function ConnectionStatus({ isConnected }) {
  return (
    <div className="connection-status">
      <div 
        className={`connection-status__indicator ${isConnected ? 'connected' : 'disconnected'}`}
        title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
      />
    </div>
  );
}

// Made with Bob
