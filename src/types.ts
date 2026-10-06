export type ItemType = 'lost' | 'found';
export type ItemStatus = 'active' | 'resolved';

export type ItemCategory = 
  | 'student_id'
  | 'keys'
  | 'electronics'
  | 'chargers'
  | 'bags_wallets'
  | 'books_supplies'
  | 'other';

export interface ClaimRequest {
  id: string;
  claimantName: string;
  claimantPhone: string;
  answerProvided?: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  claimantDeviceId?: string;
  answerConfidence?: number;
  answerAssessment?: string;
  rejectionReason?: string;
}

export interface CampusItem {
  id: string;
  type: ItemType; // 'lost' (مفقود) or 'found' (موجود)
  title: string;
  category: ItemCategory;
  location: string;
  buildingNumber?: string;
  date: string; // YYYY-MM-DD
  description: string;
  photoUrl?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  verificationQuestion?: string;
  status: ItemStatus; // 'active' or 'resolved'
  resolvedAt?: string;
  claims?: ClaimRequest[];
  claimedBy?: {
    name: string;
    contact: string;
    answerProvided?: string;
  };
  createdAt: string;
  isMyItem?: boolean;
  embedding?: number[];
  aiGenerated?: boolean;
}

export type ScreenType = 'feed' | 'post' | 'my-items' | 'detail';

export interface UserProfile {
  deviceId: string;
  displayName: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SentClaim {
  id: string;
  itemId: string;
  itemTitle: string;
  itemPhotoUrl?: string;
  itemType: ItemType;
  itemLocation: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  handoverCode?: string;
  otherPartyContact?: {
    name: string;
    phone: string;
    email?: string;
  };
}

export interface AutoMatchResult {
  matchedItem: CampusItem;
  score: number; // e.g. 55 - 100
  matchReasons: string[];
  isPreliminary?: boolean;
}
