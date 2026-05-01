export type TransactionType = 'received' | 'spent';

export interface Transaction {
  id?: string;
  date: string;
  type: TransactionType;
  amount: number;
  description: string;
  month: string; // YYYY-MM
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  settings: {
    darkMode: boolean;
  };
}

export interface MonthlySummary {
  month: string;
  received: number;
  spent: number;
  balance: number;
}
