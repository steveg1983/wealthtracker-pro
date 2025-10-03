// Mock sync server for development and testing
// This simulates a backend WebSocket server for data synchronization

import { Server, Socket } from 'socket.io';
import { createServer } from 'http';

interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId: string;
  data: unknown;
  timestamp: number;
  clientId: string;
  version: number;
}

interface ConflictResolution {
  conflictId: string;
  choice: 'local' | 'remote' | 'merge';
  mergedData?: {
    entityId: string;
    data: unknown;
    entity: string;
  };
}

interface StoredData {
  entity: string;
  data: unknown;
  timestamp: number;
  lastModified: Date;
}

interface ClientData {
  clientId: string;
  lastSeen: Date;
  pendingOperations: SyncOperation[];
}

class MockSyncServer {
  private io: Server | null = null;
  private clients: Map<string, ClientData> = new Map();
  private dataStore: Map<string, StoredData> = new Map();
  private vectorClocks: Map<string, Map<string, number>> = new Map();

  constructor() {
    if (process.env.NODE_ENV === 'development') {
      this.initialize();
    }
  }

  private initialize(): void {
    const httpServer = createServer();
    this.io = new Server(httpServer, {
      cors: {
        origin: ['http://localhost:5173', 'http://localhost:5174'],
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketHandlers();

    const port = process.env.VITE_SYNC_PORT || 3001;
    httpServer.listen(port, () => {
      console.log(`Mock sync server running on port ${port}`); // keep raw console in mock
    });
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const clientId = socket.handshake.auth.clientId;
      console.log(`Client connected: ${clientId}`);

      // Register client
      this.clients.set(socket.id, {
        clientId,
        lastSeen: new Date(),
        pendingOperations: []
      });

      // Send any pending operations for this client
      this.sendPendingOperations(socket, clientId);

      // Handle sync operations
      socket.on('sync-operation', (operation, callback) => {
        this.handleSyncOperation(socket, operation, callback);
      });

      // Handle conflict resolution
      socket.on('resolve-conflict', (resolution, callback) => {
        this.handleConflictResolution(socket, resolution, callback);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(socket.id);
      });

      // Send initial sync status
      socket.emit('sync-status', {
        connected: true,
        serverTime: new Date(),
        pendingCount: this.getPendingCount(clientId)
      });
    });
  }

  private handleSyncOperation(socket: Socket, operation: SyncOperation, callback: (result: { success: boolean; error?: string; operationId?: string }) => void): void {
    const { id, type, entity, entityId, data, timestamp, clientId, version } = operation;
    
    console.log(`Sync operation received: ${type} ${entity} ${entityId}`);

    // Check for conflicts
    const conflict = this.checkForConflict(entityId, clientId, version);
    
    if (conflict) {
      // Send conflict to client
      socket.emit('sync-conflict', {
        id: `conflict_${Date.now()}`,
        localOperation: operation,
        remoteOperation: conflict
      });
      
      callback({ success: false, error: 'Conflict detected' });
    } else {
      // Apply operation
      this.applyOperation(operation);
      
      // Update vector clock
      this.updateVectorClock(entityId, clientId, version);
      
      // Broadcast to other clients
      socket.broadcast.emit('sync-update', operation);
      
      // Acknowledge
      callback({ success: true, operationId: id });
      socket.emit('sync-ack', id);
    }
  }

  private checkForConflict(entityId: string, clientId: string, version: number): SyncOperation | null {
    const entityClock = this.vectorClocks.get(entityId);
    if (!entityClock) return null;
    
    // Check if there's a newer version from another client
    for (const [otherClientId, otherVersion] of entityClock.entries()) {
      if (otherClientId !== clientId && otherVersion >= version) {
        // Conflict detected
        const storedData = this.dataStore.get(entityId);
        if (storedData) {
          return {
            type: 'UPDATE',
            entity: storedData.entity,
            entityId,
            data: storedData.data,
            timestamp: storedData.timestamp,
            clientId: otherClientId,
            version: otherVersion
          };
        }
      }
    }
    
    return null;
  }

  private applyOperation(operation: Pick<SyncOperation, 'entityId' | 'data' | 'entity' | 'timestamp'> | SyncOperation): void {
    const { entityId, data, entity, timestamp } = operation;
    
    // Store the data
    this.dataStore.set(entityId, {
      entity,
      data,
      timestamp,
      lastModified: new Date()
    });
  }

  private updateVectorClock(entityId: string, clientId: string, version: number): void {
    if (!this.vectorClocks.has(entityId)) {
      this.vectorClocks.set(entityId, new Map());
    }
    
    const clock = this.vectorClocks.get(entityId)!;
    clock.set(clientId, version);
  }

  private handleConflictResolution(socket: Socket, resolution: ConflictResolution, callback: (result: { success: boolean }) => void): void {
    const { conflictId, choice, mergedData } = resolution;
    
    console.log(`Conflict resolution: ${conflictId} - ${choice}`);
    
    // Apply the resolution
    if (choice === 'merge' && mergedData) {
      this.applyOperation({
        entityId: mergedData.entityId,
        data: mergedData.data,
        entity: mergedData.entity,
        timestamp: Date.now()
      });
    }
    
    callback({ success: true });
  }

  private sendPendingOperations(socket: Socket, clientId: string): void {
    // In a real implementation, this would fetch pending operations from a database
    // For now, we'll just send a test message
    setTimeout(() => {
      socket.emit('pending-operations', []);
    }, 1000);
  }

  private getPendingCount(clientId: string): number {
    // In a real implementation, this would query the database
    return 0;
  }

  // Public methods for testing
  public simulateConflict(entityId: string, data: unknown): void {
    if (!this.io) return;
    
    const operation = {
      id: `server_${Date.now()}`,
      type: 'UPDATE',
      entity: 'transaction',
      entityId,
      data,
      timestamp: Date.now(),
      clientId: 'server',
      version: 999
    };
    
    this.io.emit('sync-update', operation);
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public clearData(): void {
    this.dataStore.clear();
    this.vectorClocks.clear();
  }
}

// Export singleton instance for development
export const mockSyncServer = new MockSyncServer();

// Development-only auto-start
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  console.log('Starting mock sync server for development...');
}
