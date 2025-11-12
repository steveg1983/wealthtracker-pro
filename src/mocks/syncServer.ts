// Mock sync server for development and testing
// This simulates a backend WebSocket server for data synchronization

import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { createServer } from 'http';

interface ClientData {
  clientId: string;
  lastSeen: Date;
  pendingOperations: SyncOperationPayload[];
}

interface SyncOperationPayload {
  id: string;
  type: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  timestamp: number;
  clientId: string;
  version: number;
}

interface ConflictResolutionPayload {
  conflictId: string;
  choice: 'merge' | 'local' | 'remote';
  mergedData?: {
    entityId: string;
    entity: string;
    data: Record<string, unknown>;
  };
}

type OperationAck =
  | { success: true; operationId: string }
  | { success: false; error: string };

type OperationAckCallback = (response: OperationAck) => void;

type ResolutionAck = { success: boolean };

interface StoredSyncOperation extends SyncOperationPayload {
  lastModified: Date;
}

class MockSyncServer {
  private io: Server | null = null;
  private clients: Map<string, ClientData> = new Map();
  private dataStore: Map<string, StoredSyncOperation> = new Map();
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
      console.log(`Mock sync server running on port ${port}`);
    });
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const handshakeClientId = socket.handshake.auth?.clientId;
      const clientId =
        typeof handshakeClientId === 'string' && handshakeClientId.trim().length > 0
          ? handshakeClientId
          : socket.id;
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
      socket.on('sync-operation', (operation: SyncOperationPayload, callback: OperationAckCallback) => {
        this.handleSyncOperation(socket, operation, callback);
      });

      // Handle conflict resolution
      socket.on(
        'resolve-conflict',
        (resolution: ConflictResolutionPayload, callback: (response: ResolutionAck) => void) => {
        this.handleConflictResolution(socket, resolution, callback);
        }
      );

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

  private handleSyncOperation(
    socket: Socket,
    operation: SyncOperationPayload,
    callback: OperationAckCallback
  ): void {
    const { id, type, entity, entityId, clientId, version } = operation;
    
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

  private checkForConflict(
    entityId: string,
    clientId: string,
    version: number
  ): SyncOperationPayload | null {
    const entityClock = this.vectorClocks.get(entityId);
    if (!entityClock) return null;
    
    // Check if there's a newer version from another client
    for (const [otherClientId, otherVersion] of entityClock.entries()) {
      if (otherClientId !== clientId && otherVersion >= version) {
        // Conflict detected
        const storedData = this.dataStore.get(entityId);
        if (storedData) {
          return {
            id: storedData.id,
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

  private applyOperation(operation: SyncOperationPayload): void {
    const { entityId, data, entity, timestamp, clientId, version, id, type } = operation;
    
    // Store the data
    this.dataStore.set(entityId, {
      id,
      type,
      entity,
      entityId,
      data,
      timestamp,
      clientId,
      version,
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

  private handleConflictResolution(
    socket: Socket,
    resolution: ConflictResolutionPayload,
    callback: (response: ResolutionAck) => void
  ): void {
    const { conflictId, choice, mergedData } = resolution;
    
    console.log(`Conflict resolution: ${conflictId} - ${choice}`);
    
    // Apply the resolution
    if (choice === 'merge' && mergedData) {
      const mergedOperation: SyncOperationPayload = {
        id: `merged_${Date.now()}`,
        type: 'UPDATE',
        entity: mergedData.entity,
        entityId: mergedData.entityId,
        data: mergedData.data,
        timestamp: Date.now(),
        clientId: socket.id,
        version: Date.now()
      };
      this.applyOperation(mergedOperation);
      this.updateVectorClock(mergedOperation.entityId, mergedOperation.clientId, mergedOperation.version);
    }
    
    callback({ success: true });
  }

  private sendPendingOperations(socket: Socket, _clientId: string): void {
    // In a real implementation, this would fetch pending operations from a database
    // For now, we'll just send a test message
    setTimeout(() => {
      socket.emit('pending-operations', [] as SyncOperationPayload[]);
    }, 1000);
  }

  private getPendingCount(_clientId: string): number {
    // In a real implementation, this would query the database
    return 0;
  }

  // Public methods for testing
  public simulateConflict(entityId: string, data: Record<string, unknown>): void {
    if (!this.io) {
      return;
    }
    
    const operation: SyncOperationPayload = {
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
