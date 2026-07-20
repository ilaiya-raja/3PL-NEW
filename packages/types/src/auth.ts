import { AuthRealm, type OpsRole, type PortalRole } from './enums';

export interface JwtOpsPayload {
  sub: string;
  email: string;
  name: string;
  role: OpsRole;
  realm: AuthRealm.OPS;
}

export interface JwtPortalPayload {
  sub: string;
  email: string;
  name: string;
  role: PortalRole;
  clientId: string;
  realm: AuthRealm.PORTAL;
}

export type JwtPayload = JwtOpsPayload | JwtPortalPayload;

export interface AuthUserSummary {
  id: string;
  email: string;
  name: string;
  role: OpsRole | PortalRole;
  realm: AuthRealm;
  clientId?: string;
  branding?: ClientBranding;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserSummary;
}

export interface OpsUserSession {
  id: string;
  email: string;
  name: string;
  role: OpsRole;
  realm: AuthRealm.OPS;
}

export interface PortalUserSession {
  id: string;
  email: string;
  name: string;
  role: PortalRole;
  clientId: string;
  realm: AuthRealm.PORTAL;
  branding?: ClientBranding;
}

export interface ClientBranding {
  primaryColor?: string;
  logoUrl?: string;
  companyName?: string;
}

export function isOpsPayload(payload: JwtPayload): payload is JwtOpsPayload {
  return payload.realm === AuthRealm.OPS;
}

export function isPortalPayload(payload: JwtPayload): payload is JwtPortalPayload {
  return payload.realm === AuthRealm.PORTAL;
}
