import React, { useMemo } from "react";
import { ReservationFormModal } from "../ReservationFormModal";
import { getTodayDateString } from "../../lib/date-utils";

export interface BookOnBehalfUserState {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  musicianName?: string;
  role?: string;
}

interface BookOnBehalfModalProps {
  user: BookOnBehalfUserState | null;
  instrumentsList: any[];
  onClose: () => void;
  onSubmit?: (data: any) => void;
  onSuccess?: () => void;
}

const DEFAULT_START_TIME = "18:00";

export const BookOnBehalfModal: React.FC<BookOnBehalfModalProps> = ({
  user,
  instrumentsList,
  onClose,
  onSubmit,
  onSuccess,
}) => {
  const bookableInstruments = useMemo(
    () => (instrumentsList || []).filter((i) => !(i.isRemoved ?? i.is_removed)),
    [instrumentsList],
  );

  if (!user || bookableInstruments.length === 0) return null;

  const onBehalfOf = { id: user.id, name: user.name };
  const handleSuccess = (data: any) => {
    onSubmit?.(data);
    onSuccess?.();
  };

  return (
    <ReservationFormModal
      initialInstrument={null}
      allInstruments={bookableInstruments}
      initialDate={getTodayDateString()}
      initialTimeHhmm={DEFAULT_START_TIME}
      initialMusicianName={user.musicianName || user.name}
      onBehalfOf={onBehalfOf}
      onClose={onClose}
      onSuccess={handleSuccess}
    />
  );
};
