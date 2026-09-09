import { Injectable } from '@nestjs/common';
import { SHIPMENTS, TrackingEvent, TrackingStatus } from './tracking.data.js';

export interface TrackingResult {
  orderId: string;
  customerName: string;
  currentStatus: TrackingStatus;
  lastUpdated: string;
  history: TrackingEvent[];
}

@Injectable()
export class TrackingService {
  getTracking(orderId: string): TrackingResult | null {
    const wanted = orderId.trim().toUpperCase();
    const shipment = SHIPMENTS.find((item) => item.orderId === wanted);

    if (!shipment) {
      return null;
    }

    return {
      orderId: shipment.orderId,
      customerName: shipment.customerName,
      currentStatus: shipment.currentStatus,
      lastUpdated: shipment.lastUpdated,
      history: shipment.history,
    };
  }
}