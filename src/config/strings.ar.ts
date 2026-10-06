/**
 * Centralized Arabic UI strings and copy for the تأمن (Ta'man) application.
 */

export const toArabicDigits = (val: number | string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return val.toString().replace(/\d/g, (d) => arabicDigits[parseInt(d, 10)]);
};

export const STRINGS_AR = {
  brand: {
    name: 'تأمن',
    tagline: 'مفقودات وموجودات الحرم الجامعي',
    university: 'جامعة الملك سعود',
    subtitle: 'المنصة الموحدة لطلاب جامعة الملك سعود للإبلاغ والتطابق الفوري بين المفقودات والموجودات.',
    heroHeadline: 'مفقوداتك الجامعية في أمان وتعود إليك',
    statLine: '٤٧ غرض رجع لصاحبه',
    privacyFooterNote: 'بيانات التواصل محمية ولا تُشارك إلا بعد التحقق واعتماد الطلب',
    copyright: (year: number) => `تأمن © ${year}`,
  },

  nav: {
    home: 'الرئيسية',
    post: 'إضافة بلاغ',
    myItems: 'بلاغاتي',
    mainNavAria: 'التنقل الرئيسي',
    bottomNavAria: 'شريط التنقل السفلي',
  },

  chips: {
    required: 'مطلوب',
    optional: 'اختياري',
  },

  stepper: {
    step1: 'طلب',
    step2: 'مراجعة',
    step3: 'تواصل',
    step4: 'تم',
  },

  toasts: {
    postCreated: 'تم نشر بلاغك',
    claimSubmitted: 'تم إرسال طلب الاسترداد',
    claimApproved: 'تم تأكيد التسليم',
  },

  fields: {
    type: {
      label: 'نوع البلاغ',
      helper: 'حدد ما إذا كنت تبحث عن غرض مفقود أو عثرت على غرض بالحرم',
      lostOption: 'مفقود (أبحث عن غرضي)',
      foundOption: 'موجود (عثرت على غرض)',
    },
    category: {
      label: 'فئة الغرض',
      helper: 'اختر تصنيف الغرض لتسريع المطابقة والبحث',
      defaultOption: 'اختر الفئة...',
    },
    description: {
      label: 'وصف الغرض',
      helper: 'صف الغرض بدقة والعلامات المميزة (بين ١٠ و ٢٠٠ حرف)',
      placeholder: 'اكتب وصفاً مع العلامات المميزة (مثال: محفظة جلدية سوداء بداخلها بطاقة صراف)...',
      counter: (current: number, max: number) => `${toArabicDigits(current)}/${toArabicDigits(max)}`,
    },
    location: {
      label: 'موقع الحرم الجامعي',
      helper: 'المبنى أو الكلية التي فُقد أو وُجد فيها الغرض',
      defaultOption: 'اختر الموقع الجامعي...',
    },
    date: {
      label: 'تاريخ البلاغ',
      helper: 'تاريخ الفقدان أو العثور (خلال آخر ٩٠ يوماً، غير مستقبلي)',
    },
    photo: {
      label: 'صورة الغرض',
      helper: 'صورة واضحة للغرض (JPG, PNG بحد أقصى ٥ ميجابايت)',
      tapToUpload: 'انقر للرفع أو التقاط صورة بالكاميرا',
      supportedTypes: 'يدعم جميع صيغ الصور (PNG, JPG, WebP) حتى ٥ ميجابايت',
      attachedSuccess: 'تم إرفاق الصورة بنجاح',
      attachedNote: 'ستظهر في بطاقة البلاغ لتسهيل التعرف',
      removeAria: 'حذف الصورة المرفقة',
    },
    contactBlock: {
      title: 'بيانات التواصل للتنسيق',
      privacyBadge: 'محمية وسرية',
    },
    name: {
      label: 'الاسم الكامل',
      helper: 'اسمك ثلاثي أو ثنائي كما في البطاقة (أحرف فقط)',
      placeholder: 'الاسم الكامل (أحرف فقط)',
    },
    phone: {
      label: 'رقم الجوال',
      helper: '١٠ أرقام تبدأ بـ 05 (محمي ولا يظهر للعامة)',
      placeholder: '05xxxxxxxx',
      validLiveAria: 'رقم الجوال مكتمل وصحيح',
    },
    verificationQuestion: {
      toggleTitle: 'سؤال تحقق للمالك',
      helper: 'سؤال لا يعرف إجابته إلا المالك الحقيقي (٥ أحرف على الأقل)',
      placeholder: 'مثال: ما هو الاسم المقترن بالبلوتوث أو لون الغلاف الداخلي؟',
      promptForClaimant: 'سؤال التحقق المحدد من قِبل الملتقط:',
      claimantHelper: 'يُطلب من المالك الإجابة عن هذا السؤال عند الضغط على زر الاسترداد.',
    },
    claimAnswer: {
      label: 'إجابتك للتحقق',
      helper: 'اذكر تفاصيل دقيقة أو علامة فارقة تثبت ملكيتك للغرض',
      placeholder: 'اكتب إجابتك أو العلامة الفارقة الخاصة بك...',
    },
  },

  validation: {
    summaryError: (count: number) => `يرجى تعبئة الحقول المطلوبة (${toArabicDigits(count)} حقول)`,
    summaryErrorSingle: 'يرجى تصحيح الحقل المطلوب أدناه',
    typeRequired: 'اختر نوع البلاغ: مفقود أو موجود',
    categoryRequired: 'اختر فئة الغرض',
    descriptionTooShort: 'اكتب وصفاً لا يقل عن ١٠ أحرف',
    descriptionTooLong: 'الوصف طويل، الحد ٢٠٠ حرف',
    descriptionLettersRequired: 'الوصف يجب أن يحتوي على ٣ أحرف على الأقل',
    locationRequired: 'حدد موقع الحرم الجامعي',
    dateRequired: 'حدد تاريخ البلاغ',
    dateFuture: 'لا يمكن اختيار تاريخ مستقبلي',
    dateTooOld: 'التاريخ أقدم من ٩٠ يوماً',
    photoNotImage: 'الملف ليس صورة',
    photoTooLarge: 'حجم الصورة يتجاوز ٥ ميجابايت',
    nameRequired: 'اكتب اسمك الكامل',
    nameInvalid: 'الاسم يجب أن يحتوي على أحرف فقط',
    nameTooShort: 'الاسم يجب أن يتكون من ٣ أحرف على الأقل',
    nameTooLong: 'الاسم يجب ألا يتجاوز ٤٠ حرفاً',
    phoneRequired: 'أدخل رقم الجوال',
    phoneMustStart05: 'يجب أن يبدأ الرقم بـ 05',
    phoneLength: 'رقم الجوال يتكون من ١٠ أرقام',
    verificationQuestionTooShort: 'صغ سؤالاً أوضح (٥ أحرف على الأقل)',
    claimAnswerRequired: 'أدخل إجابة سؤال التحقق',
    claimAnswerTooShort: 'الإجابة قصيرة جداً',
  },

  feed: {
    searchPlaceholder: 'ابحث باسم الغرض، الكلية، أو الوصف...',
    searchAria: 'البحث في البلاغات',
    clearSearchAria: 'مسح البحث',
    filterAll: 'الكل',
    filterLost: 'مفقود',
    filterFound: 'موجود',
    resetFilters: 'إعادة ضبط',
    categoryLabel: 'الفئة:',
    countLabel: (count: number) => `${toArabicDigits(count)} بلاغ`,
    activeFirstNote: 'تُرتب البلاغات النشطة أولاً',
    loadMore: 'عرض المزيد من البلاغات',
    emptyTitle: 'ما فيه بلاغات هنا… جرب فئة ثانية',
    emptyDesc: 'يمكنك اختيار تصنيف آخر أو إضافة بلاغ جديد للمساعدة.',
    addNewCTA: 'إضافة بلاغ جديد',
    newBadge: 'جديد',
  },

  post: {
    title: 'إضافة بلاغ',
    subtitle: 'سجل غرضك المفقود أو المعثور عليه للربط التلقائي',
    submitButton: 'نشر البلاغ وفحص التطابق',
    successTitle: 'تم نشر البلاغ بنجاح!',
    backAria: 'العودة إلى الرئيسية',
    matchFoundTitle: 'تطابق ذكي مكتشف في الحرم الجامعي!',
    matchFoundDesc: (count: number) => `عثر نظام تأمن على (${toArabicDigits(count)}) بلاغ مقابل بدرجة توافق عالية.`,
    matchScoreLabel: 'درجة التوافق',
    noMatchesTitle: 'لا توجد بلاغات مقابلة حالياً',
    noMatchesDesc: 'بلاغك متاح الآن في القائمة، وسيتم التنبيه والربط فور قيام طالب آخر بنشر بلاغ مطابق.',
    viewMyPostButton: 'عرض بلاغي',
    postAnotherLink: 'إضافة بلاغ آخر',
    matchInspectButton: 'معاينة البلاغ المقابل وطلب الاسترداد',
  },

  claim: {
    modalTitle: 'طلب استرداد الغرض',
    modalSubtitle: 'إجراء آمن للتحقق وحماية ممتلكات الطلاب',
    closeAria: 'إغلاق النافذة',
    submitButton: 'إرسال طلب الاسترداد',
    cancelButton: 'إلغاء',
    successTitle: 'تم إرسال طلب الاسترداد بنجاح!',
    pendingBadge: 'بانتظار تأكيد صاحب البلاغ',
    successDesc: 'حفاظاً على خصوصية وأمان الطرفين، تم إرسال إجابتك وبياناتك للطرف الآخر لمراجعتها. بمجرد قبوله الطلب في صفحته، سيتم تبادل معلومات التواصل مباشرة.',
    dismissSuccess: 'فهمت، العودة للبلاغات',
    primaryButtonFound: 'هذا غرضي — طلب استرداد',
    primaryButtonLost: 'عثرت على هذا الغرض',
    alreadyResolved: 'تم تسليم هذا الغرض وإغلاق البلاغ بنجاح',
  },

  myItems: {
    title: 'بلاغاتي',
    subtitle: 'البلاغات التي أضفتها في هذه الجلسة وإدارة طلبات الاسترداد',
    newPostButton: 'بلاغ جديد',
    markResolvedButton: 'تم استرجاعه',
    deleteButton: 'حذف',
    deleteAria: 'حذف البلاغ',
    emptyTitle: 'لا توجد بلاغات في جلستك الحالية',
    emptyDesc: 'البلاغات التي تنشرها من هذا المتصفح ستظهر هنا لإدارتها ومتابعة طلبات الاسترداد.',
    pendingRequestsTitle: (count: number) => `طلب استرداد بانتظار قرارك (${toArabicDigits(count)})`,
    claimantLabel: 'مقدم الطلب:',
    verificationAnswerLabel: 'إجابة التحقق المقدمة:',
    acceptClaimButton: 'قبول الطلب وتأكيد التسليم',
    rejectClaimButton: 'رفض الطلب',
    claimApprovedBadge: 'تم تأكيد التسليم مع المستلم',
    recipientLabel: 'المستلم:',
  },

  detail: {
    title: 'تفاصيل البلاغ',
    subtitle: 'معلومات الغرض وإجراءات التحقق والاسترداد الآمن',
    backAria: 'العودة إلى الرئيسية',
    descriptionLabel: 'الوصف:',
    campusLocationLabel: 'الموقع الجامعي',
    reportDateLabel: 'تاريخ البلاغ',
    privacyNote: 'بيانات التواصل محمية ولا تُشارك إلا بعد التحقق واعتماد الطلب.',
    pendingClaimAlertTitle: 'يوجد طلب استرداد قيد المراجعة',
    pendingClaimAlertDesc: 'قام طالب بتقديم إجابة للتحقق وبانتظار تأكيد صاحب البلاغ.',
    verifiedDeliveredTitle: 'تم التحقق والتسليم بنجاح',
    itemOwnerLabel: 'صاحب البلاغ:',
    highMatchTitle: 'بلاغ مقابل ذو توافق عالٍ في الحرم الجامعي:',
    inspectMatchButton: 'معاينة البلاغ',
    emptyItemTitle: 'لا يوجد بلاغ محدد',
    emptyItemDesc: 'يرجى اختيار بلاغ من القائمة الرئيسية للاطلاع على تفاصيله وإجراءات الاسترداد.',
    goToHome: 'الانتقال إلى الرئيسية',
  },

  card: {
    inspectButton: 'معاينة البلاغ والاسترداد',
    inspectResolvedButton: 'عرض تفاصيل التسليم',
    contactProtected: 'التواصل محمي',
  },

  status: {
    lost: 'مفقود',
    found: 'موجود',
    resolved: 'تم التسليم',
  },

  footer: {
    resetDemoData: 'إعادة تعيين البيانات',
    resetAria: 'إعادة تعيين بيانات التطبيق التجريبية',
  },
} as const;
