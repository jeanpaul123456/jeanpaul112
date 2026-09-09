export type TrackingStatus =
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION';

export interface TrackingEvent {
  status: TrackingStatus;
  occurredAt: string;
}

export interface Courier {
  name: string;
  reference: string;
}

export interface Shipment {
  orderId: string;
  customerName: string;
  currentStatus: TrackingStatus;
  lastUpdated: string;
  courier: Courier;
  history: TrackingEvent[];
}

export const SHIPMENTS: Shipment[] = [
  {
    orderId: 'ORD-1001',
    customerName: 'Nadia Haddad',
    currentStatus: 'OUT_FOR_DELIVERY',
    lastUpdated: '2026-08-31T10:42:00',
    courier: { name: 'SwiftShip', reference: 'SS-84421' },
    history: [
      { status: 'CREATED', occurredAt: '2026-08-29T09:05:00' },
      { status: 'IN_TRANSIT', occurredAt: '2026-08-30T14:20:00' },
      { status: 'OUT_FOR_DELIVERY', occurredAt: '2026-08-31T10:42:00' },
    ],
  },
  {
    orderId: 'ORD-1002',
    customerName: 'Karim Mansour',
    currentStatus: 'DELIVERED',
    lastUpdated: '2026-08-30T16:15:00',
    courier: { name: 'SwiftShip', reference: 'SS-84390' },
    history: [
      { status: 'CREATED', occurredAt: '2026-08-28T11:30:00' },
      { status: 'IN_TRANSIT', occurredAt: '2026-08-29T08:45:00' },
      { status: 'OUT_FOR_DELIVERY', occurredAt: '2026-08-30T09:10:00' },
      { status: 'DELIVERED', occurredAt: '2026-08-30T16:15:00' },
    ],
  },
  {
    orderId: 'ORD-1003',
    customerName: 'Lea Abboud',
    currentStatus: 'EXCEPTION',
    lastUpdated: '2026-08-30T13:05:00',
    courier: { name: 'CedarPost', reference: 'CP-20714' },
    history: [
      { status: 'CREATED', occurredAt: '2026-08-29T15:40:00' },
      { status: 'IN_TRANSIT', occurredAt: '2026-08-30T07:55:00' },
      { status: 'EXCEPTION', occurredAt: '2026-08-30T13:05:00' },
    ],
  },
];