// Razorpay event types
export interface RazorpayEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: PaymentEntity;
    };
  };
  created_at: number;
}

export interface PaymentEntity {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string;
  card_id: string | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  notes: {
    customer_id?: string;
    [key: string]: string | undefined;
  };
  fee: number;
  tax: number;
  error_code: string | null;
  error_description: string | null;
  created_at: number;
}

// Database types matching your schema
export interface Customer {
  id: string;
  fullName?: string;
  displayName?: string;
  phoneNumber: string;
  isPhoneVerified: boolean;
  email?: string;
  isEmailVerified?: boolean;
  createdAt: Date;
  isActive: boolean;
  subscriptionStatus: "ACTIVE" | "INACTIVE" | "CANCELLED";
  walletBalance: number;
  defaultAddressID?: string;
}

export interface Wallet {
  id: string;
  customerID: string;
  balance: number;
  creditLimit: number;
  updatedAt: Date;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  customerId: string;
  amount: number;
  status: string;
  createdAt: Date;
}
