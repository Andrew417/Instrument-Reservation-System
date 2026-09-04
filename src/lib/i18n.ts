import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import ar from "../locales/ar.json";

export const LANGUAGE_STORAGE_KEY = "church_app_language_v1";

const savedLang =
  typeof window !== "undefined"
    ? localStorage.getItem(LANGUAGE_STORAGE_KEY)
    : null;
const initialLanguage = savedLang === "ar" ? "ar" : "en";

// Apply initial dir and lang attributes to the document root
if (typeof document !== "undefined") {
  const isAr = initialLanguage === "ar";
  document.documentElement.setAttribute("dir", isAr ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", initialLanguage);
  if (isAr) {
    document.documentElement.classList.add("rtl");
  } else {
    document.documentElement.classList.remove("rtl");
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    const isAr = lng === "ar";
    document.documentElement.setAttribute("dir", isAr ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lng);
    if (isAr) {
      document.documentElement.classList.add("rtl");
    } else {
      document.documentElement.classList.remove("rtl");
    }
  }
});

export default i18n;
