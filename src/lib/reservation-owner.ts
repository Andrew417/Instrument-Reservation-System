export interface OnBehalfOf {
  id: string;
  name: string;
}

export const buildOwnerPayload = (
  profile: { id: string; role?: string } | null,
  onBehalfOf?: OnBehalfOf | null,
) => {
  if (onBehalfOf) return { onBehalfOfUserId: onBehalfOf.id };
  const isAdminRole =
    profile?.role === "admin" || profile?.role === "super_admin";
  return {
    userId: isAdminRole ? null : profile?.id,
    adminId: isAdminRole ? profile?.id : null,
  };
};
