export interface ControlledServers {
  host: string
  availableRam: number;
}

export interface ServerNotification {
  host: string;
  status: 'recycle' | 'rooted' | 'weakened' | 'grown' | 'hacked';
}