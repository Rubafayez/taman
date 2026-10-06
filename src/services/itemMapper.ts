import { CampusItem } from '../types';

/**
 * Mapper: transforms a database row (snake_case) into a frontend CampusItem (camelCase)
 */
export function mapRowToItem(row: any, currentDeviceId: string): CampusItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    location: row.location,
    buildingNumber: row.building_number || undefined,
    date: row.date || row.item_date || new Date().toISOString().split('T')[0],
    description: row.description,
    photoUrl: row.photo_url || undefined,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email || undefined,
    verificationQuestion: row.verification_question || undefined,
    status: row.status,
    resolvedAt: row.resolved_at || undefined,
    claimedBy:
      row.claimed_by_name || row.claimed_by_contact
        ? {
            name: row.claimed_by_name || '',
            contact: row.claimed_by_contact || '',
            answerProvided: row.claimed_by_answer || undefined,
          }
        : undefined,
    claims: (row.claims || []).map((c: any) => ({
      id: c.id,
      claimantName: c.claimant_name,
      claimantPhone: c.claimant_phone,
      answerProvided: c.answer_provided || undefined,
      submittedAt: c.created_at,
      status: c.status,
      claimantDeviceId: c.claimant_device_id || undefined,
      answerConfidence:
        c.answer_confidence !== null && c.answer_confidence !== undefined
          ? Number(c.answer_confidence)
          : undefined,
      answerAssessment: c.answer_assessment || undefined,
      rejectionReason: c.rejection_reason || undefined,
    })),
    createdAt: row.created_at,
    isMyItem: Boolean(
      (row.creator_device_id && row.creator_device_id === currentDeviceId) ||
      (row.owner_device_id && row.owner_device_id === currentDeviceId)
    ),
    embedding: row.embedding || undefined,
    aiGenerated: row.ai_generated !== undefined ? Boolean(row.ai_generated) : undefined,
  };
}

/**
 * Mapper: transforms frontend CampusItem data into database insert/update row.
 * Only sends valid database columns and NEVER sends id, created_at, updated_at,
 * isMyItem or claims.
 */
export function mapItemToRow(itemData: Partial<CampusItem>, deviceId: string): Record<string, any> {
  const row: Record<string, any> = {};

  if (itemData.type !== undefined) row.type = itemData.type;
  if (itemData.title !== undefined) row.title = itemData.title;
  if (itemData.category !== undefined) row.category = itemData.category;
  if (itemData.location !== undefined) row.location = itemData.location;
  if (itemData.buildingNumber !== undefined) row.building_number = itemData.buildingNumber;
  if (itemData.description !== undefined) row.description = itemData.description;
  if (itemData.photoUrl !== undefined) row.photo_url = itemData.photoUrl;
  if (itemData.contactName !== undefined) row.contact_name = itemData.contactName;
  if (itemData.contactPhone !== undefined) row.contact_phone = itemData.contactPhone;
  if (itemData.contactEmail !== undefined) row.contact_email = itemData.contactEmail;
  if (itemData.verificationQuestion !== undefined) row.verification_question = itemData.verificationQuestion;
  if (itemData.status !== undefined) row.status = itemData.status;
  if (itemData.resolvedAt !== undefined) row.resolved_at = itemData.resolvedAt;
  if (itemData.aiGenerated !== undefined) row.ai_generated = itemData.aiGenerated;
  if (itemData.embedding !== undefined) row.embedding = itemData.embedding;

  // The database column for date
  if (itemData.date !== undefined) {
    row.date = itemData.date;
  }

  if (itemData.claimedBy) {
    row.claimed_by_name = itemData.claimedBy.name;
    row.claimed_by_contact = itemData.claimedBy.contact;
    row.claimed_by_answer = itemData.claimedBy.answerProvided || null;
  }

  row.creator_device_id = deviceId;

  return row;
}
