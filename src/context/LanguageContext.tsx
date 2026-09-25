import { AR_PAGES } from '@/i18n/ar';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Lang = 'en' | 'ar';
const KEY = 'wealthos.lang';

const AR: Record<string, string> = {
  Overview: 'نظرة عامة', Dashboard: 'لوحة التحكم', 'Net Worth': 'صافي الثروة', Updates: 'التحديثات',
  Notifications: 'الإشعارات', Portfolio: 'المحفظة', Holdings: 'الأسهم', 'Composite View': 'عرض مجمّع',
  'Portfolio Lab': 'مختبر المحفظة', Watchlist: 'قائمة المراقبة', Transactions: 'المعاملات', 'Tax Lots': 'الدفعات الضريبية',
  Allocation: 'التوزيع', Compare: 'مقارنة', Analysis: 'التحليل', Analytics: 'التحليلات', Performance: 'الأداء',
  Benchmarking: 'المقارنة المرجعية', 'Financial Health': 'الصحة المالية', 'Risk Analysis': 'تحليل المخاطر',
  Diversification: 'التنويع', 'Portfolio Health': 'صحة المحفظة', 'Health Dashboard': 'لوحة الصحة',
  'Peer Compare': 'مقارنة بالأقران', 'True Returns': 'العوائد الحقيقية', 'Fair Value': 'القيمة العادلة',
  'Intrinsic Value': 'القيمة الجوهرية', 'Risks & Rewards': 'المخاطر والمكافآت', 'ETF Look-Through': 'تفاصيل الصناديق',
  'Activity Feed': 'سجل النشاط', 'Options Flow': 'تدفق الخيارات', '12-Module Analysis': 'تحليل ١٢ وحدة',
  Dividends: 'التوزيعات', 'Income Forecast': 'توقع الدخل', 'Safety Scores': 'درجات الأمان', Changes: 'التغييرات',
  'CAGR & YoC': 'النمو والعائد على التكلفة', Halal: 'حلال', Zakat: 'الزكاة', Settings: 'الإعدادات',
  Research: 'الأبحاث', Community: 'المجتمع', Tools: 'الأدوات', Leaderboard: 'لوحة المتصدرين',
  'Yield on cost': 'العائد على التكلفة', 'Income concentration': 'تركّز الدخل', 'Financial independence': 'الاستقلال المالي',
  'Currency vs real income': 'الدخل: أثر العملة مقابل النمو الحقيقي',
};

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string; }
const LanguageContext = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: s => s });

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(KEY) as Lang) || 'en');
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  const setLang = (l: Lang) => { localStorage.setItem(KEY, l); setLangState(l); };
  const t = (s: string) => (lang === 'ar' ? AR[s] ?? AR_PAGES[s] ?? s : s);
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);

export const LanguageToggle = ({ className = '' }: { className?: string }) => {
  const { lang, setLang } = useLanguage();
  return (
    <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={`text-xs font-semibold px-2 py-1 rounded-md border border-border hover:bg-muted ${className}`}
      aria-label="Switch language">
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
};
