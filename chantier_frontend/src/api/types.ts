export type Paginated<T> = {
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  default_currency: string;
  country: string;
  is_active: boolean;
};

export type Membership = {
  id: string;
  tenant: Tenant;
  role: string;
  is_active: boolean;
};

export type Me = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  language: string;
  timezone: string;
  preferred_currency: string;
  memberships: Membership[];
};

export type ApiRecord = Record<string, unknown> & {
  id: string | number;
  name?: string;
  title?: string;
  code?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};
