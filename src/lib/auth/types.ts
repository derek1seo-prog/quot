export type Role = "admin" | "customer";

export interface AdminSessionPayload {
  role: "admin";
  sub: "admin";
  iat: number;
  exp: number;
}

export interface CustomerSessionPayload {
  role: "customer";
  sub: string; // Customer.id
  customerName: string; // denormalized for display without a data-store round trip
  iat: number;
  exp: number;
}

export type SessionPayload = AdminSessionPayload | CustomerSessionPayload;
