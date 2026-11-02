import React from "react";
import { useAuth } from "../contexts/AuthContext.tsx";
import {
  ReservationChatView,
  ReservationChatViewProps,
} from "./ReservationChatView.tsx";

export type UserChatViewProps = Omit<ReservationChatViewProps, "mode">;

export const UserChatView: React.FC<UserChatViewProps> = (props) => {
  const { profile } = useAuth();
  const isAdmin = Boolean(
    profile?.role === "admin" ||
      profile?.role === "super_admin" ||
      profile?.isSuperAdmin,
  );
  return <ReservationChatView mode={isAdmin ? "admin" : "user"} {...props} />;
};
