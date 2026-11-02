import React from "react";
import {
  ReservationChatView,
  ReservationChatViewProps,
} from "../../ReservationChatView.tsx";

export type MessagingTabProps = Omit<ReservationChatViewProps, "mode">;

export const MessagingTab: React.FC<MessagingTabProps> = (props) => {
  return <ReservationChatView mode="admin" {...props} />;
};
