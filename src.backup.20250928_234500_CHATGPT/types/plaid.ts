// Type definitions for Plaid service

export interface SavedPlaidConnection {
  id: string;
  institutionId: string;
  institutionName: string;
  accessToken?: string; // To be removed if present
  itemId: string;
  lastSync: string;
  accounts: string[];
  status: string;
  error?: string;
  isDevelopment?: boolean;
}

export interface PlaidApiParams {
  access_token?: string;
  institution_id?: string;
  start_date?: string;
  end_date?: string;
  account_ids?: string[];
  [key: string]: string | string[] | undefined;
}