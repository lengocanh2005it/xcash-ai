export interface OnboardingGrant {
  id: string;
  grantId: string;
  accountNumber: string | null;
  accountHolderName: string | null;
  bankName: string | null;
  bankLogo: string | null;
  linkedAt: string;
  status: string;
}

export interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface OnboardingStatus {
  currentStep: number;
  bankingLinked: boolean;
  grants: OnboardingGrant[];
  steps: OnboardingStep[];
}

export interface GrantTokenResponse {
  grantToken: string;
  expiresAt: string | null;
  redirectUri: string;
  linkBaseUrl: string;
}

export interface BankingCallbackResponse {
  grantId: string;
  accountNumber: string | null;
  accountHolderName: string | null;
  bankName: string | null;
  bankLogo: string | null;
  linkedAt: string;
}
