import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Globe,
  Check,
  LogOut,
  Sparkles,
  Shield,
  User,
  Award,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.tsx";

export interface LanguageProfileDropdownProps {
  className?: string;
  onOpenMinistryProfile?: () => void;
  hideMinistryProfile?: boolean;
}

export const LanguageProfileDropdown: React.FC<
  LanguageProfileDropdownProps
> = ({
  className = "",
  onOpenMinistryProfile,
  hideMinistryProfile = false,
}) => {
  const { t, i18n } = useTranslation();
  const { profile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language || "en";
  const isAr = currentLang === "ar";

  const isAdmin = Boolean(
    profile?.role === "admin" ||
      profile?.role === "super_admin" ||
      profile?.isSuperAdmin,
  );

  const shouldShowMinistryProfile =
    Boolean(onOpenMinistryProfile) && !hideMinistryProfile && !isAdmin;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (lng: "en" | "ar") => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  const getRoleBadge = () => {
    if (profile?.role === "super_admin" || profile?.isSuperAdmin) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
          {t("common.superAdmin")}
        </span>
      );
    }
    if (profile?.role === "admin") {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-stone-200 text-stone-800">
          {t("common.admin")}
        </span>
      );
    }
    if (profile?.isTrusted) {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
          <Sparkles className="w-2.5 h-2.5" />
          {t("common.trusted")}
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-stone-100 text-stone-600">
        {t("common.member")}
      </span>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left ${className}`}
      id="language-profile-dropdown"
    >
      <button
        id="profile-dropdown-trigger-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-0 sm:gap-2 px-1.5 sm:px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200 rounded-xl text-xs shrink-0 transition cursor-pointer select-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={t("common.profile")}
      >
        <div className="relative shrink-0">
          <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : "M"}
          </div>
          <div
            className={`sm:hidden absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-800 ring-2 ring-white flex items-center justify-center transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <ChevronDown className="w-2 h-2 text-white" strokeWidth={3} />
          </div>
        </div>
        <div className="hidden sm:flex flex-col text-start min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-stone-900 leading-none truncate max-w-[110px] lg:max-w-[180px]">
              {profile?.name || t("common.member")}
            </span>
            <span className="shrink-0">{getRoleBadge()}</span>
          </div>
          <span className="text-[10px] text-stone-500 truncate max-w-[140px] lg:max-w-[220px] mt-0.5">
            {profile?.email || profile?.phoneNumber || ""}
          </span>
        </div>
        <ChevronDown
          className={`hidden sm:block w-3.5 h-3.5 text-stone-500 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          id="profile-dropdown-menu"
          className="absolute right-0 rtl:right-auto rtl:left-0 mt-1.5 w-64 max-w-[calc(100vw-1.5rem)] bg-white border border-stone-200 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
        >
          {/* User Card inside dropdown */}
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-sm shrink-0">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : "M"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-stone-900 text-xs truncate">
                  {profile?.name || t("common.member")}
                </div>
                <div className="text-[11px] text-stone-500 truncate">
                  {profile?.email || profile?.phoneNumber || ""}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {getRoleBadge()}
            </div>
          </div>

          {/* Ministry Profile Action — Only for musicians / regular members, hidden from Admin Portal */}
          {shouldShowMinistryProfile && (
            <div className="px-3 pt-2 pb-1.5 border-b border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenMinistryProfile?.();
                }}
                className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-50 to-amber-100/60 hover:from-amber-100/80 hover:to-amber-100 border border-amber-200/90 transition cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center gap-2.5 min-w-0 text-start">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-amber-200 transition">
                    <Award className="w-4 h-4 text-amber-800" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-stone-900 leading-tight truncate">
                      {isAr
                        ? "🌟 ملفي الخدمي وسجل ساعات التسبيح"
                        : "🌟 My Ministry Record & Worship Hours"}
                    </div>
                    <div className="text-[10px] text-stone-500 font-normal truncate mt-0.5">
                      {isAr
                        ? "عرض أوسمة الخدمة وساعات العزف ونسبة الالتزام"
                        : "View earned badges, service hours & reliability"}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-amber-900 bg-white px-2 py-0.5 rounded-lg border border-amber-200 shadow-2xs shrink-0 whitespace-nowrap">
                  {isAr ? "عرض الأوسمة" : "View Honors"}
                </span>
              </button>
            </div>
          )}

          {/* Language Selection Section */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" />
              <span>{t("common.language")}</span>
            </div>

            <div className="space-y-1">
              {/* English Option */}
              <button
                id="language-select-en"
                type="button"
                onClick={() => handleLanguageChange("en")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  !isAr
                    ? "bg-amber-50 text-amber-950 border border-amber-200 font-bold"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">🇺🇸</span>
                  <span>English</span>
                </div>
                {!isAr && <Check className="w-4 h-4 text-amber-800 shrink-0" />}
              </button>

              {/* Arabic Option */}
              <button
                id="language-select-ar"
                type="button"
                onClick={() => handleLanguageChange("ar")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isAr
                    ? "bg-amber-50 text-amber-950 border border-amber-200 font-bold"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">🇪🇬</span>
                  <span className="font-bold">العربية</span>
                </div>
                {isAr && <Check className="w-4 h-4 text-amber-800 shrink-0" />}
              </button>
            </div>
          </div>

          {/* Sign Out Action */}
          <div className="px-2 pt-1 border-t border-stone-100">
            <button
              id="profile-dropdown-signout-btn"
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("common.signOut")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
