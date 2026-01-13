export interface User {
  name: string;
  email: string;
  ROLE_NAME: string;
  permission: string;
  password: string;
  status: string;
  created_by: string;
  created_at: string;
  last_login: string;
  updated_by: string;
  updated_at: string;
  actions: string;
}

export interface Role {
  ID: number;
  ROLE_NAME: string;
  ROLE_KEY: string;
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  cpassword?: string;
  role_id: number;
  college_perm: number;
  hs_perm: number;
  ocr_perm: number;
  status: number;
}

