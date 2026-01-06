// WebSocket service for real-time notifications
import { Server as HttpServer } from 'http';
// @ts-ignore - socket.io types will be available after npm install socket.io @types/socket.io
import { Server as SocketServer, Socket } from 'socket.io';
import logger from '../utils/logger.ts';
import { JWTService } from '../utils/jwt.ts';
import type { Notification, NotificationPayload, NotificationMetadata } from '../models/notification.ts';

// TypeScript types for socket.io (will be available after npm install socket.io @types/socket.io)
// @ts-ignore - Socket type will be properly defined after package installation
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}


class WebSocketService {
  private io: SocketServer | null = null;
  private connectedClients: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer): void {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: process.env['CORS_ORIGIN']?.split(',') || '*',
        credentials: true,
      },
      path: '/socket.io',
    });

    // Authentication middleware
    // @ts-ignore - Socket types will be available after package installation
    this.io.use(async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
      try {
        // @ts-ignore
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          logger.warn('WebSocket connection rejected: No token provided', {
            // @ts-ignore
            socketId: socket.id,
          });
          return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const decoded = JWTService.verifyAccessToken(token);
        if (!decoded || !decoded.sub) {
          logger.warn('WebSocket connection rejected: Invalid token', {
            // @ts-ignore
            socketId: socket.id,
          });
          return next(new Error('Invalid token'));
        }

        socket.userId = decoded.sub; // JWT uses 'sub' for user ID
        socket.userRole = decoded.role;
        next();
      } catch (error: any) {
        logger.error('WebSocket authentication error', {
          // @ts-ignore
          socketId: socket.id,
          error,
        });
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    // @ts-ignore
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      // @ts-ignore
      const socketId = socket.id;

      // Track connected client
      if (!this.connectedClients.has(userId)) {
        this.connectedClients.set(userId, new Set());
      }
      this.connectedClients.get(userId)!.add(socketId);

      logger.info('WebSocket client connected', {
        socketId,
        userId,
        userRole: socket.userRole,
        totalConnections: this.connectedClients.get(userId)!.size,
      });

      // Handle disconnection
      // @ts-ignore
      socket.on('disconnect', () => {
        const userSockets = this.connectedClients.get(userId);
        if (userSockets) {
          userSockets.delete(socketId);
          if (userSockets.size === 0) {
            this.connectedClients.delete(userId);
          }
        }

        logger.info('WebSocket client disconnected', {
          socketId,
          userId,
          remainingConnections: userSockets?.size || 0,
        });
      });

      // Handle errors
      // @ts-ignore
      socket.on('error', (error: any) => {
        logger.error('WebSocket error', {
          socketId,
          userId,
          error,
        });
      });

      // Optional: Handle ping/pong for keep-alive
      // @ts-ignore
      socket.on('ping', () => {
        // @ts-ignore
        socket.emit('pong');
      });
    });

    logger.info('✅ WebSocket server initialized');
  }

  /**
   * Send notification to a specific user
   * @param userId - Target user ID to receive the notification
   * @param notificationPayload - The notification payload with type and data
   * @param metadata - Optional metadata (priority, category, etc.)
   */
  notifyUser(
    userId: string, 
    notificationPayload: NotificationPayload,
    metadata?: NotificationMetadata
  ): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot send notification');
      return;
    }

    const userSockets = this.connectedClients.get(userId);
    if (!userSockets || userSockets.size === 0) {
      logger.debug('User not connected, notification will not be delivered', {
        userId,
        notificationPayload,
      });
      return;
    }

    // Create full notification object
    const notification: Notification = {
      id: crypto.randomUUID(),
      type: notificationPayload.type,
      payload: notificationPayload.payload,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Send to all sockets for this user (in case they have multiple tabs/devices)
    userSockets.forEach((socketId) => {
      this.io!.to(socketId).emit('notification', notification);
    });

    logger.info('Notification sent to user', {
      userId,
      socketCount: userSockets.size,
      notificationType: notificationPayload.type,
      notificationId: notification.id,
      metadata,
    });
  }

  /**
   * Broadcast notification to multiple users
   * @param userIds - Array of target user IDs
   * @param notificationPayload - The notification payload with type and data
   * @param metadata - Optional metadata (priority, category, etc.)
   */
  notifyUsers(
    userIds: string[], 
    notificationPayload: NotificationPayload,
    metadata?: Omit<NotificationMetadata, 'userId'>
  ): void {
    userIds.forEach((userId) => {
      this.notifyUser(userId, notificationPayload, {
        ...metadata,
        userId,
      });
    });
  }

  /**
   * Send a custom notification with full control
   * @param userId - Target user ID
   * @param notification - Complete notification object
   */
  sendNotification(userId: string, notification: Notification): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot send notification');
      return;
    }

    const userSockets = this.connectedClients.get(userId);
    if (!userSockets || userSockets.size === 0) {
      logger.debug('User not connected, notification will not be delivered', {
        userId,
        notification,
      });
      return;
    }

    userSockets.forEach((socketId) => {
      this.io!.to(socketId).emit('notification', notification);
    });

    logger.info('Custom notification sent to user', {
      userId,
      socketCount: userSockets.size,
      notificationType: notification.type,
      notificationId: notification.id,
    });
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    const userSockets = this.connectedClients.get(userId);
    return userSockets !== undefined && userSockets.size > 0;
  }

  /**
   * Get count of connected clients for a user
   */
  getConnectionCount(userId: string): number {
    const userSockets = this.connectedClients.get(userId);
    return userSockets ? userSockets.size : 0;
  }

  /**
   * Get total connected clients count
   */
  getTotalConnections(): number {
    let total = 0;
    this.connectedClients.forEach((sockets) => {
      total += sockets.size;
    });
    return total;
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.io) {
      this.io.close(() => {
        logger.info('WebSocket server closed');
      });
      this.connectedClients.clear();
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

