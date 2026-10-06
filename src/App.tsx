import { useState, useEffect } from 'react';
import { CampusItem, ScreenType, ClaimRequest } from './types';
import { itemsService } from './services/itemsService';
import { demoService, DemoPersona } from './services/demoService';
import { profileService } from './services/profileService';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { FeedScreen } from './components/FeedScreen';
import { PostScreen } from './components/PostScreen';
import { MyItemsScreen } from './components/MyItemsScreen';
import { DetailScreen } from './components/DetailScreen';
import { ClaimModal } from './components/ClaimModal';
import { DemoSwitcher } from './components/DemoSwitcher';
import { Toast } from './components/Toast';
import { ConfettiBurst } from './components/ConfettiBurst';
import { STRINGS_AR } from './config/strings.ar';

export default function App() {
  // Items & session state driven via itemsService
  const [items, setItems] = useState<CampusItem[]>([]);
  const [myItemIds, setMyItemIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hidden Demo Mode state (Activated ONLY when ?demo=1 or stored in sessionStorage)
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [activeDemoPersona, setActiveDemoPersona] = useState<DemoPersona | null>(null);

  // Screen navigation state
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('feed');
  const [selectedItem, setSelectedItem] = useState<CampusItem | null>(null);

  // Claim modal state
  const [claimingItem, setClaimingItem] = useState<CampusItem | null>(null);

  // Edit item modal state (RLS Update)
  const [editingItem, setEditingItem] = useState<CampusItem | null>(null);

  // Feedback toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Confetti burst state for resolved moment
  const [showConfetti, setShowConfetti] = useState(false);

  // Initial load from itemsService (Supabase)
  useEffect(() => {
    async function loadData() {
      try {
        const loadedItems = await itemsService.getItems();
        setItems(loadedItems);
      } catch (err: any) {
        console.error('Error loading items from Supabase:', err);
        setToast({
          message: err?.message || 'تعذر تحميل البلاغات من قاعدة البيانات',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Initialize Demo Mode if ?demo=1 or active in sessionStorage
  useEffect(() => {
    if (demoService.isDemoActive()) {
      setIsDemoMode(true);
      const persona = demoService.initDemoMode();
      setActiveDemoPersona(persona);
    }
  }, []);

  // Switch demo identity without page reload
  const handleSwitchDemoPersona = async (persona: DemoPersona) => {
    demoService.switchPersona(persona);
    setActiveDemoPersona(persona);

    // Pre-populate demo persona profile if contact name is empty
    try {
      const p = await profileService.getProfile();
      if (!p.contactName || p.contactName.trim().length === 0) {
        await profileService.updateProfile({
          displayName: persona.name,
          contactName: persona.defaultContactName,
          contactPhone: persona.defaultPhone,
        });
      }
    } catch {}

    // Re-fetch items from Supabase with new device ID and re-render
    try {
      const freshItems = await itemsService.getItems();
      setItems(freshItems);
      if (selectedItem) {
        const updated = freshItems.find((i) => i.id === selectedItem.id);
        if (updated) {
          setSelectedItem(updated);
        }
      }
    } catch (err: any) {
      console.warn('Error reloading items on demo persona switch:', err);
    }

    showToast(`أنت الآن: ${persona.name}`, 'success');
  };

  // Exit demo mode and restore real device id
  const handleExitDemoMode = async () => {
    demoService.exitDemoMode();
    setIsDemoMode(false);
    setActiveDemoPersona(null);

    // Re-fetch items from Supabase with real device ID
    try {
      const freshItems = await itemsService.getItems();
      setItems(freshItems);
      if (selectedItem) {
        const updated = freshItems.find((i) => i.id === selectedItem.id);
        if (updated) {
          setSelectedItem(updated);
        }
      }
    } catch (err: any) {
      console.warn('Error reloading items after exiting demo mode:', err);
    }

    showToast('تم الخروج من وضع العرض', 'success');
  };

  // Derived: My items list (items created by this device)
  const myItems = items.filter((item) => item.isMyItem);

  // Derived: Pending claims count for badge
  const pendingClaimsCount = myItems.reduce((acc, itm) => {
    const count = itm.claims?.filter((c) => c.status === 'pending').length || 0;
    return acc + count;
  }, 0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleSelectItem = (item: CampusItem) => {
    setSelectedItem(item);
    setCurrentScreen('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (screen: ScreenType) => {
    setEditingItem(null);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemCreated = async (newItemData: Omit<CampusItem, 'id' | 'createdAt' | 'status'>) => {
    try {
      const created = await itemsService.createItem(newItemData);
      // Update local state ONLY from the row returned after successful database write
      setItems((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      setSelectedItem(created);
      showToast(STRINGS_AR.toasts.postCreated, 'success');
      return created;
    } catch (err: any) {
      console.error('Failed to create item in Supabase:', err);
      showToast(err?.message || 'فشل في حفظ البلاغ في قاعدة البيانات', 'error');
      throw err;
    }
  };

  const handleOpenClaim = (item: CampusItem) => {
    setClaimingItem(item);
  };

  // Submit Claim (Pending State — Does NOT immediately reveal contact details)
  const handleSubmitClaim = async (
    itemId: string,
    claimData: Omit<ClaimRequest, 'id' | 'submittedAt' | 'status'>
  ) => {
    try {
      const { item: updatedItem } = await itemsService.createClaim(itemId, claimData);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      if (selectedItem?.id === itemId) {
        setSelectedItem(updatedItem);
      }
      showToast(STRINGS_AR.toasts.claimSubmitted, 'success');
    } catch (err: any) {
      console.error('Failed creating claim in Supabase:', err);
      showToast(err?.message || 'فشل في إرسال طلب الاسترداد', 'error');
    }
  };

  // Trigger resolved moment celebration
  const triggerResolvedMoment = () => {
    setShowConfetti(true);
    showToast(STRINGS_AR.toasts.claimApproved, 'success');
  };

  // Approve Claim (From "بلاغاتي" — verifies the answer, marks resolved, reveals contact)
  const handleApproveClaim = async (itemId: string, claimId: string) => {
    try {
      const updatedItem = await itemsService.approveClaim(itemId, claimId);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      if (selectedItem?.id === itemId) {
        setSelectedItem(updatedItem);
      }
      triggerResolvedMoment();
    } catch (err: any) {
      console.error('Failed approving claim in Supabase:', err);
      showToast(err?.message || 'فشل في اعتماد طلب الاسترداد', 'error');
    }
  };

  // Reject Claim
  const handleRejectClaim = async (itemId: string, claimId: string, reason?: string) => {
    try {
      const updatedItem = await itemsService.rejectClaim(itemId, claimId, reason);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      if (selectedItem?.id === itemId) {
        setSelectedItem(updatedItem);
      }
      showToast('تم رفض الطلب بنجاح', 'success');
    } catch (err: any) {
      console.error('Failed rejecting claim in Supabase:', err);
      showToast(err?.message || 'فشل في رفض الطلب', 'error');
    }
  };

  // Mark Resolved Directly
  const handleMarkResolved = async (itemId: string) => {
    try {
      const updatedItem = await itemsService.markResolved(itemId);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      if (selectedItem?.id === itemId) {
        setSelectedItem(updatedItem);
      }
      triggerResolvedMoment();
    } catch (err: any) {
      console.error('Failed marking resolved in Supabase:', err);
      showToast(err?.message || 'فشل في تحديث حالة البلاغ', 'error');
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    try {
      await itemsService.deleteItem(itemId);
      // Update local state ONLY after server confirms deletion
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
        setCurrentScreen('my-items');
      }
      showToast('تم حذف البلاغ من قاعدة البيانات بنجاح', 'success');
    } catch (err: any) {
      console.error('Failed deleting item in Supabase:', err);
      showToast(err?.message || 'فشل في حذف البلاغ من قاعدة البيانات', 'error');
    }
  };

  // Update Item in Supabase (RLS Update)
  const handleUpdateItem = async (itemId: string, updates: Partial<CampusItem>) => {
    try {
      const updated = await itemsService.updateItem(itemId, updates);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      if (selectedItem?.id === itemId) {
        setSelectedItem(updated);
      }
      showToast('تم حفظ التعديلات بنجاح في قاعدة البيانات', 'success');
      return updated;
    } catch (err: any) {
      console.error('Failed updating item in Supabase:', err);
      showToast(err?.message || 'فشل في تحديث بيانات البلاغ', 'error');
      throw err;
    }
  };

  // Cancel a claim
  const handleCancelClaim = async (claimId: string) => {
    try {
      await itemsService.cancelClaim(claimId);
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          claims: item.claims?.filter((c) => c.id !== claimId),
        }))
      );
      if (selectedItem) {
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                claims: prev.claims?.filter((c) => c.id !== claimId),
              }
            : null
        );
      }
      showToast('تم إلغاء طلب الاسترداد بنجاح', 'success');
    } catch (err: any) {
      console.error('Failed canceling claim:', err);
      showToast('تعذر إلغاء الطلب', 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0B0D] text-[#F2F5F9] w-full max-w-full overflow-x-hidden">
      {/* Navigation: Desktop Top Header + Mobile Bottom Tab Bar (3 items: الرئيسية · إضافة بلاغ · بلاغاتي) */}
      <Header
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        myItemsCount={myItems.length}
        pendingClaimsCount={pendingClaimsCount}
      />

      {/* Main Content Area */}
      <main className="app-container py-[clamp(20px,3.5vw,40px)] flex-1 pb-[88px] md:pb-8 min-w-0">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-[#4D9BFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {currentScreen === 'feed' && (
              <FeedScreen
                items={items}
                isLoading={isLoading}
                onSelectItem={handleSelectItem}
                onNavigateToPost={() => handleNavigate('post')}
              />
            )}

            {currentScreen === 'post' && (
              <PostScreen
                existingItems={items}
                editMode={Boolean(editingItem)}
                editingItem={editingItem}
                onItemCreated={handleItemCreated}
                onItemUpdated={async (updated) => {
                  await handleUpdateItem(updated.id, updated);
                  setEditingItem(null);
                  setCurrentScreen('my-items');
                }}
                onCancelEdit={() => {
                  setEditingItem(null);
                  setCurrentScreen('my-items');
                }}
                onNavigateToDetail={(item) => {
                  setSelectedItem(item);
                  setCurrentScreen('detail');
                }}
                onNavigateToFeed={() => {
                  setEditingItem(null);
                  handleNavigate('feed');
                }}
                onShowToast={showToast}
              />
            )}

            {currentScreen === 'my-items' && (
              <MyItemsScreen
                myItems={myItems}
                allItems={items}
                onSelectItem={handleSelectItem}
                onEditItem={(item) => {
                  setEditingItem(item);
                  setCurrentScreen('post');
                }}
                onMarkResolved={handleMarkResolved}
                onDeleteItem={handleDeleteItem}
                onApproveClaim={handleApproveClaim}
                onRejectClaim={handleRejectClaim}
                onNavigateToPost={() => handleNavigate('post')}
                onNavigateToFeed={() => handleNavigate('feed')}
              />
            )}

            {currentScreen === 'detail' && (
              <DetailScreen
                item={selectedItem}
                allItems={items}
                onOpenClaim={handleOpenClaim}
                onSelectItem={(item) => setSelectedItem(item)}
                onNavigateToFeed={() => handleNavigate('feed')}
                onNavigateToMyClaims={() => handleNavigate('my-items')}
                onEditItem={(item) => {
                  setEditingItem(item);
                  setCurrentScreen('post');
                }}
                onDeleteItem={handleDeleteItem}
                onMarkResolved={handleMarkResolved}
                onCancelClaim={handleCancelClaim}
                onApproveClaim={handleApproveClaim}
                onRejectClaim={handleRejectClaim}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Claim Confirmation Modal */}
      <ClaimModal
        item={claimingItem}
        isOpen={!!claimingItem}
        onClose={() => setClaimingItem(null)}
        onSubmitClaim={handleSubmitClaim}
      />

      {/* Toast Feedback for state changes */}
      <Toast
        message={toast?.message || null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />

      {/* Confetti Burst Celebration for Resolved Moment (1.2s, blue/emerald only, soundless) */}
      <ConfettiBurst
        active={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

      {/* Hidden Demo Mode Switcher (Visible ONLY when demo mode active) */}
      {isDemoMode && (
        <DemoSwitcher
          activePersona={activeDemoPersona}
          isModalOpen={Boolean(claimingItem || editingItem)}
          onSelectPersona={handleSwitchDemoPersona}
          onExitDemo={handleExitDemoMode}
        />
      )}
    </div>
  );
}
