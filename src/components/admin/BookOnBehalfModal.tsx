import React, { useMemo, useState } from "react";
import { ReservationFormModal, SeriesPrefill } from "../ReservationFormModal";
import { SeriesBuilderModal } from "../SeriesBuilderModal";
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
  const [seriesPrefill, setSeriesPrefill] = useState<SeriesPrefill | null>(
    null,
  );

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

  if (seriesPrefill) {
    return (
      <SeriesBuilderModal
        initialInstrument={seriesPrefill.instrument}
        allInstruments={bookableInstruments}
        initialServiceName={seriesPrefill.serviceName}
        initialMusicianName={seriesPrefill.musicianName}
        initialNote={seriesPrefill.note}
        initialDate={seriesPrefill.date}
        initialTimeHhmm={seriesPrefill.startTime}
        initialDuration={seriesPrefill.duration}
        initialReservationType={seriesPrefill.reservationType}
        onBehalfOf={onBehalfOf}
        onBack={() => setSeriesPrefill(null)}
        onClose={onClose}
        onSuccess={handleSuccess}
      />
    );
  }

  return (
    <ReservationFormModal
      initialInstrument={bookableInstruments[0]}
      allInstruments={bookableInstruments}
      initialDate={getTodayDateString()}
      initialTimeHhmm={DEFAULT_START_TIME}
      initialMusicianName={user.musicianName || user.name}
      onBehalfOf={onBehalfOf}
      onOpenSeriesBuilder={setSeriesPrefill}
      onClose={onClose}
      onSuccess={handleSuccess}
    />
  );
};
