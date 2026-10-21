import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Eye, EyeOff } from "lucide-react";

export interface NewAdminFormState {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  isSuperAdmin: boolean;
}

interface NewAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: NewAdminFormState) => void;
}

export const NewAdminModal: React.FC<NewAdminModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<NewAdminFormState>({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    isSuperAdmin: false,
  });
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">
              {t("admin.modals.provisionAdmin.title")}
            </h3>
            <p className="text-xs text-stone-500">
              {t("admin.modals.provisionAdmin.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.provisionAdmin.fullNameLabel")}
            </label>
            <input
              type="text"
              required
              placeholder={t("admin.modals.provisionAdmin.namePlaceholder")}
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.provisionAdmin.emailLabel")}
            </label>
            <input
              type="email"
              required
              placeholder={t("admin.modals.provisionAdmin.emailPlaceholder")}
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.provisionAdmin.phoneLabel")}
            </label>
            <input
              type="tel"
              placeholder={t("admin.modals.provisionAdmin.phonePlaceholder")}
              value={form.phoneNumber}
              onChange={(e) =>
                setForm({
                  ...form,
                  phoneNumber: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.provisionAdmin.passwordLabel")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                className="w-full pl-3 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
              />
              <button
                type="button"
                id="btn-toggle-new-admin-password"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition cursor-pointer focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center gap-2">
            <input
              type="checkbox"
              id="check-is-super-admin"
              checked={form.isSuperAdmin}
              onChange={(e) =>
                setForm({
                  ...form,
                  isSuperAdmin: e.target.checked,
                })
              }
              className="w-4 h-4 accent-amber-800 rounded cursor-pointer"
            />
            <label
              htmlFor="check-is-super-admin"
              className="text-amber-950 cursor-pointer text-xs"
            >
              {t("admin.modals.provisionAdmin.superAdminCheckbox")}
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
            >
              {t("admin.modals.provisionAdmin.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer shadow-xs"
            >
              {t("admin.modals.provisionAdmin.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
