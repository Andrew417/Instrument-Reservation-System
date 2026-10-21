import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export interface InstrumentFormState {
  name: string;
  type: string;
  photoUrl: string;
  description: string;
  outsideFeePerDay: string;
  bookingMode: "instant" | "manual";
}

interface InstrumentFormModalProps {
  isOpen: boolean;
  editingInstrument: any | null;
  initialForm: InstrumentFormState;
  onClose: () => void;
  onSave: (form: InstrumentFormState) => void;
}

import { INSTRUMENT_CATEGORIES } from "../../constants/instruments";

const CATEGORIES = INSTRUMENT_CATEGORIES;

export const InstrumentFormModal: React.FC<InstrumentFormModalProps> = ({
  isOpen,
  editingInstrument,
  initialForm,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<InstrumentFormState>(initialForm);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState<boolean>(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialForm);
    setShowUrlInput(false);
    setPhotoUploadError(null);
    setIsDraggingPhoto(false);
    setIsProcessingPhoto(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [isOpen, initialForm, editingInstrument?.id]);

  if (!isOpen) return null;

  const processImageFile = (file: File) => {
    setPhotoUploadError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoUploadError(
        t("admin.modals.instrumentForm.invalidImageTypeError") ||
          "Please select a valid image file (PNG, JPG, WebP).",
      );
      return;
    }
    const MAX_RAW_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_RAW_BYTES) {
      setPhotoUploadError(
        t("admin.modals.instrumentForm.imageTooLargeError") ||
          "Image must be smaller than 10MB.",
      );
      return;
    }

    setIsProcessingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_DIM = 1200;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setPhotoUploadError("Failed to process image canvas.");
            setIsProcessingPhoto(false);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setForm((prev) => ({ ...prev, photoUrl: dataUrl }));
          setShowUrlInput(false);
        } catch {
          setPhotoUploadError("Failed to resize image.");
        } finally {
          setIsProcessingPhoto(false);
        }
      };
      img.onerror = () => {
        setPhotoUploadError("Failed to decode image.");
        setIsProcessingPhoto(false);
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      setPhotoUploadError("Failed to read file.");
      setIsProcessingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handlePhotoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(true);
  };

  const handlePhotoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(false);
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRemovePhoto = () => {
    setForm((prev) => ({ ...prev, photoUrl: "" }));
    setPhotoUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="font-bold text-stone-900 text-sm">
            {editingInstrument
              ? t("admin.modals.instrumentForm.editTitle")
              : t("admin.modals.instrumentForm.addTitle")}
          </h3>
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
              {t("admin.modals.instrumentForm.nameLabel")}
            </label>
            <input
              type="text"
              required
              placeholder={t("admin.modals.instrumentForm.namePlaceholder")}
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t("admin.modals.instrumentForm.categoryLabel")}
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t("admin.modals.instrumentForm.bookingModeLabel")}
              </label>
              <select
                value={form.bookingMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bookingMode: e.target.value as "instant" | "manual",
                  })
                }
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
              >
                <option value="instant">
                  {t("admin.modals.instrumentForm.instantOption")}
                </option>
                <option value="manual">
                  {t("admin.modals.instrumentForm.manualOption")}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.instrumentForm.feeLabel")}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.outsideFeePerDay}
              onChange={(e) =>
                setForm({
                  ...form,
                  outsideFeePerDay: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.instrumentForm.descriptionLabel")}
            </label>
            <textarea
              rows={2}
              placeholder={t(
                "admin.modals.instrumentForm.descriptionPlaceholder",
              )}
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-stone-700">
                {t("admin.modals.instrumentForm.photoLabel")}
              </label>
              {form.photoUrl ? (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{t("admin.modals.instrumentForm.removePhoto")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 transition cursor-pointer"
                >
                  {showUrlInput
                    ? t("admin.modals.instrumentForm.switchToUpload")
                    : t("admin.modals.instrumentForm.pasteUrl")}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp, image/gif"
              onChange={handlePhotoFileChange}
              className="hidden"
              id="instrument-photo-file-input"
            />

            {form.photoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-stone-300 bg-stone-900 group shadow-2xs">
                <div className="h-44 w-full flex items-center justify-center bg-stone-950/20">
                  <img
                    src={form.photoUrl}
                    alt="Instrument preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-stone-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-2xs">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-stone-900 text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t("admin.modals.instrumentForm.changePhoto")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t("admin.modals.instrumentForm.remove")}</span>
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg bg-stone-900/80 text-white text-[10px] font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{t("admin.modals.instrumentForm.photoAttached")}</span>
                </div>
              </div>
            ) : showUrlInput ? (
              <div className="space-y-1.5">
                <input
                  type="url"
                  placeholder={t("admin.modals.instrumentForm.urlPlaceholder")}
                  value={form.photoUrl}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      photoUrl: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
                <p className="text-[10px] text-stone-400">
                  {t("admin.modals.instrumentForm.urlHint")}
                </p>
              </div>
            ) : (
              <div
                id="instrument-photo-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handlePhotoDragOver}
                onDragEnter={handlePhotoDragOver}
                onDragLeave={handlePhotoDragLeave}
                onDrop={handlePhotoDrop}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2 select-none ${
                  isDraggingPhoto
                    ? "border-amber-600 bg-amber-50/90 scale-[1.01]"
                    : "border-stone-300 hover:border-amber-700 hover:bg-stone-50/80 bg-stone-50/50"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    isDraggingPhoto
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-50 border border-amber-200 text-amber-800"
                  }`}
                >
                  {isProcessingPhoto ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-stone-800 text-xs">
                    {isDraggingPhoto
                      ? t("admin.modals.instrumentForm.dropzoneDrop")
                      : isProcessingPhoto
                        ? t("admin.modals.instrumentForm.dropzoneProcessing")
                        : t("admin.modals.instrumentForm.dropzoneClick")}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {t("admin.modals.instrumentForm.dropzoneSupports")}
                  </p>
                </div>
              </div>
            )}

            {photoUploadError && (
              <div className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{photoUploadError}</span>
              </div>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
            >
              {t("admin.modals.instrumentForm.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer shadow-xs"
            >
              {editingInstrument
                ? t("admin.modals.instrumentForm.update")
                : t("admin.modals.instrumentForm.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
