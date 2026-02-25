import type { Country, UserStatus } from "@prisma/client";

export interface StepConditions {
  country?: Country[];
  cluster?: string[];
  position?: string[];
  userStatus?: UserStatus[];
  requiresCorporateEmail?: boolean;
  requiresSsoAuth?: boolean;
  hiredAfter?: string;
  hiredBefore?: string;
  tags?: string[];
}

export interface UserProfile {
  country: Country;
  clusterName: string;
  position: string | null;
  status: UserStatus;
  hasCorporateEmail: boolean;
  hasSsoAuth: boolean;
  createdAt: Date;
  tags: string[];
}

export interface ContentBlockMeta {
  label?: string;
  thumbnailUrl?: string;
  fileName?: string;
  checklistItems?: string[];
}

export interface ContentBlock {
  id: string;
  type: "RICH_TEXT" | "VIDEO_EMBED" | "PDF_LINK" | "CHECKLIST" | "FORM_LINK";
  value: string;
  meta?: ContentBlockMeta;
}

export interface ContentPayload {
  blocks: ContentBlock[];
}
