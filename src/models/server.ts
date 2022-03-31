export interface ControlledServers {
  host: string
  availableRam: number;
}

export interface ServerNotification {
  host: string;
  status: 'rooted' | 'weakened' | 'grown' | 'hacked';
}