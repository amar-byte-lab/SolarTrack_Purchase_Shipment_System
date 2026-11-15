export interface User {
  userid: string;
  username: string;
  role: string;
  email?: string;
  mobile?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  message?: string;
}

export interface RegisterRequest {
  userid: string;
  username: string;
  email: string;
  password: string;
  mobile?: string;
  role: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface RolesResponse {
  success: boolean;
  roles: string[];
}
