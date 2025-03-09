// src/services/ViewportManager.ts
import { Viewport, BoundingBox } from "./filterTypes";
import { SpatialIndex } from "./SpatialIndex";

export class ViewportManager {
  private viewports = new Map<string, Viewport>();
  // Track previous viewport to optimize for frequent viewport changes
  private previousViewports = new Map<string, Viewport>();
  private spatialIndex: SpatialIndex;

  constructor(spatialIndex: SpatialIndex) {
    this.spatialIndex = spatialIndex;
  }

  /**
   * Update a client's viewport
   */
  updateViewport(clientId: string, boundingBox: BoundingBox, zoom: number): void {
    // Store previous viewport for later use
    const currentViewport = this.viewports.get(clientId);
    if (currentViewport) {
      this.previousViewports.set(clientId, currentViewport);
    }

    // Create new viewport
    const viewport: Viewport = {
      clientId,
      boundingBox,
      zoom,
      updatedAt: new Date().toISOString(),
    };

    // Store viewport
    this.viewports.set(clientId, viewport);
  }

  /**
   * Get a client's current viewport
   */
  getViewport(clientId: string): Viewport | null {
    return this.viewports.get(clientId) || null;
  }

  /**
   * Get all events within a client's viewport
   */
  getEventsInViewport(clientId: string): any[] {
    const viewport = this.viewports.get(clientId);
    if (!viewport) {
      return [];
    }

    return this.spatialIndex.queryBoundingBox(viewport.boundingBox);
  }

  /**
   * Get all client IDs with viewports
   */
  getAllClientIds(): string[] {
    return Array.from(this.viewports.keys());
  }

  /**
   * Calculate the difference between the current and previous viewport
   * Optimizes data transfer by only sending events in newly visible areas
   */
  getViewportDifference(clientId: string): BoundingBox | null {
    const currentViewport = this.viewports.get(clientId);
    const previousViewport = this.previousViewports.get(clientId);

    if (!currentViewport) {
      return null;
    }

    if (!previousViewport) {
      return currentViewport.boundingBox; // Send full viewport
    }

    // Get current and previous bounds
    const curr = currentViewport.boundingBox;
    const prev = previousViewport.boundingBox;

    // If viewports don't overlap, return entire new viewport
    if (
      curr.maxX < prev.minX ||
      curr.minX > prev.maxX ||
      curr.maxY < prev.minY ||
      curr.minY > prev.maxY
    ) {
      return curr;
    }

    // Calculate the difference (this is a simplified approach)
    // In a production implementation, you'd calculate the true geometric difference
    const diffBbox = {
      minX: Math.min(curr.minX, prev.minX),
      minY: Math.min(curr.minY, prev.minY),
      maxX: Math.max(curr.maxX, prev.maxX),
      maxY: Math.max(curr.maxY, prev.maxY),
    };

    return diffBbox;
  }

  /**
   * Clean up when a client disconnects
   */
  handleClientDisconnect(clientId: string): void {
    this.viewports.delete(clientId);
    this.previousViewports.delete(clientId);
  }
  updateClientId(oldClientId: string, newClientId: string): void {
    // Update current viewport if it exists
    const currentViewport = this.viewports.get(oldClientId);
    if (currentViewport) {
      // Update the clientId in the viewport object
      currentViewport.clientId = newClientId;

      // Store under the new ID
      this.viewports.set(newClientId, currentViewport);

      // Remove from old ID
      this.viewports.delete(oldClientId);
    }

    // Update previous viewport if it exists
    const previousViewport = this.previousViewports.get(oldClientId);
    if (previousViewport) {
      // Update the clientId in the viewport object
      previousViewport.clientId = newClientId;

      // Store under the new ID
      this.previousViewports.set(newClientId, previousViewport);

      // Remove from old ID
      this.previousViewports.delete(oldClientId);
    }
  }
}
