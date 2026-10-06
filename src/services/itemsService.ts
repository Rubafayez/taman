import { CampusItem, ClaimRequest, SentClaim } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { aiService } from './aiService';
import { mapRowToItem, mapItemToRow } from './itemMapper';

export { mapRowToItem, mapItemToRow };

const MY_CLAIMS_KEY = 'taman:my_claim_ids';
let memoryClaimIds: string[] = [];

// In-memory guard sets so automatic evaluation never runs twice for the same claim ID
const evaluatingClaimIds = new Set<string>();
const evaluatedClaimIds = new Set<string>();

export function isClaimEvaluatedOrEvaluating(claimId: string): boolean {
  return evaluatingClaimIds.has(claimId) || evaluatedClaimIds.has(claimId);
}

export function markClaimAsEvaluating(claimId: string): void {
  evaluatingClaimIds.add(claimId);
}

export function getMyClaimIds(): string[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const devId = getDeviceId();
      const perDeviceRaw = localStorage.getItem(`${MY_CLAIMS_KEY}:${devId}`);
      if (perDeviceRaw) {
        return JSON.parse(perDeviceRaw);
      }
      const raw = localStorage.getItem(MY_CLAIMS_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {}
  return memoryClaimIds;
}

export function saveMyClaimId(claimId: string): void {
  try {
    const devId = getDeviceId();
    const current = getMyClaimIds();
    if (!current.includes(claimId)) {
      current.push(claimId);
      memoryClaimIds = current;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${MY_CLAIMS_KEY}:${devId}`, JSON.stringify(current));
        localStorage.setItem(MY_CLAIMS_KEY, JSON.stringify(current));
      }
    }
  } catch {}
}

export function removeMyClaimId(claimId: string): void {
  try {
    const devId = getDeviceId();
    const current = getMyClaimIds().filter((id) => id !== claimId);
    memoryClaimIds = current;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${MY_CLAIMS_KEY}:${devId}`, JSON.stringify(current));
      localStorage.setItem(MY_CLAIMS_KEY, JSON.stringify(current));
    }
  } catch {}
}

/**
 * The only thing localStorage may still hold is the device id ("taman:device_id").
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('taman:device_id');
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('taman:device_id', id);
    }
    return id;
  } catch {
    return 'default-device-id';
  }
}

function handleSupabaseError(action: string, error: any): never {
  console.error(`Supabase ${action} error:`, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  });
  throw new Error(error?.message || `Failed to ${action}`);
}

/**
 * Service API for items & claims connecting directly to Supabase.
 */
export const itemsService = {
  async getItems(): Promise<CampusItem[]> {
    if (!isSupabaseConfigured) {
      console.error('Supabase is not configured properly in itemsService.getItems');
    }

    const deviceId = getDeviceId();
    const { data, error } = await supabase
      .from('items')
      .select('*, claims(*)')
      .order('created_at', { ascending: false });

    if (error) {
      handleSupabaseError('fetch items', error);
    }

    return (data || []).map((row) => mapRowToItem(row, deviceId));
  },

  async getItem(id: string): Promise<CampusItem | null> {
    const deviceId = getDeviceId();
    const { data, error } = await supabase
      .from('items')
      .select('*, claims(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      handleSupabaseError(`fetch item ${id}`, error);
    }

    return data ? mapRowToItem(data, deviceId) : null;
  },

  /**
   * Fetches full item rows from the items table for a list of UUIDs.
   * Useful when an RPC like match_items returns only { id, similarity }.
   */
  async getItemsByIds(ids: string[]): Promise<CampusItem[]> {
    if (!ids || ids.length === 0) return [];
    const validIds = ids.filter((id) => Boolean(id));
    if (validIds.length === 0) return [];

    const deviceId = getDeviceId();
    const { data, error } = await supabase
      .from('items')
      .select('*, claims(*)')
      .in('id', validIds);

    if (error) {
      console.warn('Failed to fetch items by ids:', error.message);
      return [];
    }

    return (data || []).map((row) => mapRowToItem(row, deviceId));
  },

  /**
   * Semantic matching via match_items RPC:
   * Note on the semantic matching RPC: match_items(query_embedding, opposite_type, exclude_id,
   * match_threshold, match_count) returns ONLY two columns: id (uuid) and similarity (float).
   * After calling it, fetch the full rows for those ids from the items table (or match them against
   * the items already loaded in state) — do not expect title, description, category, location, date,
   * photo or type to come back from the RPC.
   */
  async matchItemsSemantic(
    queryEmbedding: number[],
    oppositeType: 'lost' | 'found',
    excludeId?: string,
    matchThreshold = 0.35,
    matchCount = 10,
    loadedItems?: CampusItem[]
  ): Promise<Array<{ item: CampusItem; similarity: number }>> {
    if (!isSupabaseConfigured || !queryEmbedding || queryEmbedding.length === 0) {
      return [];
    }

    try {
      const isValidUuid = (id?: string) =>
        typeof id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const { data: rpcRows, error: rpcErr } = await supabase.rpc('match_items', {
        query_embedding: queryEmbedding,
        opposite_type: oppositeType,
        exclude_id: isValidUuid(excludeId) ? excludeId : null,
        match_threshold: matchThreshold,
        match_count: matchCount,
      });

      if (rpcErr || !Array.isArray(rpcRows) || rpcRows.length === 0) {
        if (rpcErr) {
          console.warn('match_items RPC error:', rpcErr.message);
        }
        return [];
      }

      // The RPC returns ONLY two columns: id (uuid) and similarity (float).
      const rpcResults: Array<{ id: string; similarity: number }> = [];
      for (const row of rpcRows) {
        if (row?.id && typeof row.similarity === 'number') {
          rpcResults.push({ id: row.id, similarity: row.similarity });
        }
      }

      if (rpcResults.length === 0) return [];

      // Match against items already loaded in state first
      const itemMap = new Map<string, CampusItem>();
      if (loadedItems && loadedItems.length > 0) {
        for (const item of loadedItems) {
          itemMap.set(item.id, item);
        }
      }

      // Fetch full rows from the items table for any IDs not already in state
      const missingIds = rpcResults.map((r) => r.id).filter((id) => !itemMap.has(id));
      if (missingIds.length > 0) {
        const fetchedItems = await this.getItemsByIds(missingIds);
        for (const it of fetchedItems) {
          itemMap.set(it.id, it);
        }
      }

      // Assemble full rows with similarity, strictly excluding own reports and same type
      const deviceId = getDeviceId();
      const finalMatches: Array<{ item: CampusItem; similarity: number }> = [];
      for (const r of rpcResults) {
        const fullItem = itemMap.get(r.id);
        if (
          fullItem &&
          fullItem.status === 'active' &&
          fullItem.type === oppositeType &&
          !fullItem.isMyItem &&
          (fullItem as any).owner_device_id !== deviceId &&
          (fullItem as any).creator_device_id !== deviceId
        ) {
          finalMatches.push({
            item: fullItem,
            similarity: r.similarity,
          });
        }
      }

      return finalMatches;
    } catch (err) {
      console.warn('matchItemsSemantic failed:', err);
      return [];
    }
  },

  async createItem(
    itemData: Omit<CampusItem, 'id' | 'createdAt' | 'status'>
  ): Promise<CampusItem> {
    const deviceId = getDeviceId();
    const row = mapItemToRow(itemData, deviceId);

    // Let the database generate the uuid id, created_at, and updated_at
    const { data, error } = await supabase
      .from('items')
      .insert(row)
      .select('*, claims(*)')
      .single();

    if (error) {
      handleSupabaseError('create item', error);
    }

    const createdItem = mapRowToItem(data, deviceId);

    // Feature 2: Background semantic embedding generation (never blocks success screen)
    aiService
      .embedItem(
        `${itemData.title}. ${itemData.description}. ${itemData.category}. ${itemData.location}`
      )
      .then((embedding) => {
        if (embedding && Array.isArray(embedding) && isSupabaseConfigured) {
          supabase
            .from('items')
            .update({ embedding })
            .eq('id', createdItem.id)
            .then(({ error: embedErr }) => {
              if (embedErr) {
                console.warn('Could not save embedding to items table:', embedErr.message);
              } else {
                createdItem.embedding = embedding;
              }
            });
        }
      })
      .catch((err) => console.warn('Background embedding error:', err));

    return createdItem;
  },

  async updateItem(id: string, updates: Partial<CampusItem>): Promise<CampusItem> {
    const deviceId = getDeviceId();
    const row = mapItemToRow(updates, deviceId);
    // Don't overwrite the original creator
    delete row.creator_device_id;

    const { data, error } = await supabase
      .from('items')
      .update(row)
      .eq('id', id)
      .select('*, claims(*)')
      .single();

    if (error) {
      handleSupabaseError(`update item ${id}`, error);
    }

    return mapRowToItem(data, deviceId);
  },

  async deleteItem(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    if (error) {
      handleSupabaseError(`delete item ${id}`, error);
    }

    return true;
  },

  async markResolved(id: string): Promise<CampusItem> {
    return this.updateItem(id, {
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    });
  },

  async confirmHandover(itemId: string): Promise<CampusItem> {
    return this.markResolved(itemId);
  },

  async createClaim(
    itemId: string,
    claimData: Omit<ClaimRequest, 'id' | 'submittedAt' | 'status'>
  ): Promise<{ item: CampusItem; claim: ClaimRequest }> {
    const deviceId = getDeviceId();
    let claimRow: any = null;
    let claimErr: any = null;

    // Feature 3: Evaluate verification answer advisory assessment if provided
    let assessedConfidence: number | undefined = undefined;
    let assessedText: string | undefined = undefined;

    if (claimData.answerProvided && claimData.answerProvided.trim().length > 0) {
      const targetItem = await this.getItem(itemId);
      if (targetItem) {
        try {
          const result = await aiService.assessClaimAnswer(
            targetItem.description,
            targetItem.verificationQuestion || '',
            claimData.answerProvided
          );
          if (result) {
            assessedConfidence = result.confidence;
            assessedText = result.assessment;
          }
        } catch (err) {
          console.warn('Non-blocking claim answer assessment error:', err);
        }
      }
    }

    // Attempt insertion with claimant_device_id and AI assessment fields
    const insertPayload: Record<string, any> = {
      item_id: itemId,
      claimant_name: claimData.claimantName,
      claimant_phone: claimData.claimantPhone,
      answer_provided: claimData.answerProvided || null,
      status: 'pending',
      claimant_device_id: deviceId,
    };

    if (assessedConfidence !== undefined) {
      insertPayload.answer_confidence = assessedConfidence;
    }
    if (assessedText !== undefined) {
      insertPayload.answer_assessment = assessedText;
    }

    const firstAttempt = await supabase
      .from('claims')
      .insert(insertPayload)
      .select()
      .single();

    if (
      firstAttempt.error &&
      (firstAttempt.error.code === '42703' ||
        firstAttempt.error.code === 'PGRST204' ||
        firstAttempt.error.message?.includes('claimant_device_id') ||
        firstAttempt.error.message?.includes('answer_confidence') ||
        firstAttempt.error.message?.includes('answer_assessment'))
    ) {
      // Fallback if AI assessment columns or claimant_device_id don't exist yet in Supabase schema
      const fallbackAttempt = await supabase
        .from('claims')
        .insert({
          item_id: itemId,
          claimant_name: claimData.claimantName,
          claimant_phone: claimData.claimantPhone,
          answer_provided: claimData.answerProvided || null,
          status: 'pending',
        })
        .select()
        .single();
      claimRow = fallbackAttempt.data;
      claimErr = fallbackAttempt.error;
    } else {
      claimRow = firstAttempt.data;
      claimErr = firstAttempt.error;
    }

    if (claimErr) {
      handleSupabaseError('create claim', claimErr);
    }

    if (claimRow?.id) {
      saveMyClaimId(claimRow.id);
    }

    const updatedItem = await this.getItem(itemId);
    if (!updatedItem) {
      throw new Error(`Item ${itemId} not found after creating claim`);
    }

    const claim: ClaimRequest = {
      id: claimRow.id,
      claimantName: claimRow.claimant_name,
      claimantPhone: claimRow.claimant_phone,
      answerProvided: claimRow.answer_provided || undefined,
      submittedAt: claimRow.created_at,
      status: claimRow.status,
      claimantDeviceId: claimRow.claimant_device_id || deviceId,
      answerConfidence:
        claimRow.answer_confidence !== undefined && claimRow.answer_confidence !== null
          ? Number(claimRow.answer_confidence)
          : assessedConfidence,
      answerAssessment: claimRow.answer_assessment || assessedText,
    };

    return { item: updatedItem, claim };
  },

  /**
   * Automatic evaluation for existing claims:
   * Finds claims where answer_provided is not null AND answer_confidence is null,
   * runs AI assessment via Gemini, and saves answer_confidence & answer_assessment back to claims table.
   * Guarded with in-memory set so it never runs twice for the same id.
   */
  async evaluateClaimAnswer(
    claimId: string,
    itemDescription: string,
    verificationQuestion: string,
    claimantAnswer: string
  ): Promise<{ confidence: number; assessment: string } | null> {
    if (!claimId || !claimantAnswer || claimantAnswer.trim().length === 0) {
      return null;
    }

    if (evaluatedClaimIds.has(claimId)) {
      return null;
    }

    evaluatingClaimIds.add(claimId);

    try {
      const result = await aiService.assessClaimAnswer(
        itemDescription,
        verificationQuestion,
        claimantAnswer
      );

      if (!result || typeof result.confidence !== 'number') {
        evaluatedClaimIds.add(claimId);
        evaluatingClaimIds.delete(claimId);
        return null;
      }

      // Save both values back to claims table in Supabase
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('claims')
            .update({
              answer_confidence: result.confidence,
              answer_assessment: result.assessment,
            })
            .eq('id', claimId);

          if (error) {
            console.warn('Could not save claim assessment to Supabase:', error.message);
          }
        } catch (dbErr) {
          console.warn('Database error saving claim assessment:', dbErr);
        }
      }

      evaluatedClaimIds.add(claimId);
      evaluatingClaimIds.delete(claimId);
      return result;
    } catch (err) {
      console.warn('evaluateClaimAnswer non-blocking error:', err);
      evaluatedClaimIds.add(claimId);
      evaluatingClaimIds.delete(claimId);
      return null;
    }
  },

  async approveClaim(itemId: string, claimId: string): Promise<CampusItem> {
    // 1. Update claim status to approved
    const { data: claimRow, error: claimErr } = await supabase
      .from('claims')
      .update({ status: 'approved' })
      .eq('id', claimId)
      .select()
      .single();

    if (claimErr) {
      handleSupabaseError(`approve claim ${claimId}`, claimErr);
    }

    // 2. Update item to resolved and record claimed_by
    const { data: itemRow, error: itemErr } = await supabase
      .from('items')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        claimed_by_name: claimRow.claimant_name,
        claimed_by_contact: claimRow.claimant_phone,
        claimed_by_answer: claimRow.answer_provided,
      })
      .eq('id', itemId)
      .select('*, claims(*)')
      .single();

    if (itemErr) {
      handleSupabaseError(`resolve item ${itemId}`, itemErr);
    }

    return mapRowToItem(itemRow, getDeviceId());
  },

  async rejectClaim(itemId: string, claimId: string, reason?: string): Promise<CampusItem> {
    const updatePayload: Record<string, any> = { status: 'rejected' };
    if (reason) {
      updatePayload.rejection_reason = reason;
    }

    const { error: claimErr } = await supabase
      .from('claims')
      .update(updatePayload)
      .eq('id', claimId);

    if (claimErr) {
      const fallback = await supabase
        .from('claims')
        .update({ status: 'rejected' })
        .eq('id', claimId);

      if (fallback.error) {
        handleSupabaseError(`reject claim ${claimId}`, fallback.error);
      }
    }

    const updatedItem = await this.getItem(itemId);
    if (!updatedItem) {
      throw new Error(`Item ${itemId} not found after rejecting claim`);
    }

    if (reason && updatedItem.claims) {
      const targetClaim = updatedItem.claims.find((c) => c.id === claimId);
      if (targetClaim) {
        targetClaim.rejectionReason = reason;
      }
    }

    return updatedItem;
  },

  /**
   * Retrieves all claims initiated by this device on other people's items ("طلباتي")
   */
  async getMyClaims(): Promise<SentClaim[]> {
    const myClaimIds = getMyClaimIds();
    const currentDevId = getDeviceId();
    const allItems = await this.getItems();
    const sentClaims: SentClaim[] = [];

    for (const item of allItems) {
      if (!item.claims || item.claims.length === 0) continue;
      for (const claim of item.claims) {
        const isMyClaim =
          myClaimIds.includes(claim.id) ||
          Boolean(claim.claimantDeviceId && claim.claimantDeviceId === currentDevId);

        if (isMyClaim) {
          sentClaims.push({
            id: claim.id,
            itemId: item.id,
            itemTitle: item.title,
            itemPhotoUrl: item.photoUrl,
            itemType: item.type,
            itemLocation: item.location,
            submittedAt: claim.submittedAt,
            status: claim.status,
            rejectionReason:
              claim.rejectionReason ||
              (claim.status === 'rejected'
                ? 'الإجابة المقدمة غير مطابقة لمواصفات الغرض أو البيانات غير كافية'
                : undefined),
            handoverCode:
              claim.status === 'approved'
                ? `TK-${item.id.slice(0, 4).toUpperCase()}`
                : undefined,
            otherPartyContact:
              claim.status === 'approved'
                ? {
                    name: item.contactName,
                    phone: item.contactPhone,
                    email: item.contactEmail,
                  }
                : undefined,
          });
        }
      }
    }

    return sentClaims.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  },

  /**
   * Cancels a pending claim request sent by this device
   */
  async cancelClaim(claimId: string): Promise<boolean> {
    removeMyClaimId(claimId);
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('claims').delete().eq('id', claimId);
        if (error) {
          console.warn('Could not delete claim from Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Error deleting claim:', err);
      }
    }
    return true;
  },

  async resetItems(): Promise<CampusItem[]> {
    // Directly fetch current items from database
    return this.getItems();
  },

  getMyItemIds(): string[] {
    // Device ID matches are derived directly from items.isMyItem
    return [];
  },

  async getStats(): Promise<{
    totalReports: number;
    resolvedItems: number;
    coveredLocations: number;
    thisWeekReports: number;
  }> {
    const items = await this.getItems();
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const totalReports = items.length;
    const resolvedItems = items.filter((i) => i.status === 'resolved').length;

    const uniqueLocations = new Set(
      items
        .map((i) => i.location?.trim())
        .filter((loc) => Boolean(loc))
    );
    const coveredLocations = uniqueLocations.size;

    const thisWeekReports = items.filter((i) => {
      const createdTime = new Date(i.createdAt).getTime();
      return !isNaN(createdTime) && createdTime >= sevenDaysAgo;
    }).length;

    return {
      totalReports,
      resolvedItems,
      coveredLocations,
      thisWeekReports,
    };
  },

  isClaimEvaluatedOrEvaluating(claimId: string): boolean {
    return isClaimEvaluatedOrEvaluating(claimId);
  },

  markClaimAsEvaluating(claimId: string): void {
    markClaimAsEvaluating(claimId);
  },
};
