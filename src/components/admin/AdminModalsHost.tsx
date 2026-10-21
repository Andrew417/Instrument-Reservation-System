import React from "react";
import { InstrumentFormModal } from "./InstrumentFormModal";
import { RetireInstrumentModal } from "./RetireInstrumentModal";
import { DeleteInstrumentModal } from "./DeleteInstrumentModal";
import { BookOnBehalfModal } from "./BookOnBehalfModal";
import { NewAdminModal } from "./NewAdminModal";
import { RejectReasonModal } from "./RejectReasonModal";
import { CancelReasonModal } from "./CancelReasonModal";
import { AdminConfirmModal } from "./AdminConfirmModal";
import { PromoteUserModal } from "./PromoteUserModal";
import { HandoverSheetModal } from "../HandoverSheetModal";
import { UserDetailModal } from "../UserDetailModal";
import { AssignInstrumentModal } from "../AssignInstrumentModal";

export interface AdminModalsHostProps {
  admin: any;
  onOpenReservationDetail?: (reservationId: string) => void;
}

export const AdminModalsHost: React.FC<AdminModalsHostProps> = ({
  admin,
  onOpenReservationDetail,
}) => {
  return (
    <>
      <InstrumentFormModal
        isOpen={admin.showInstrumentModal}
        editingInstrument={admin.editingInstrument}
        initialForm={admin.instrumentForm}
        onClose={() => {
          admin.setShowInstrumentModal(false);
          admin.setEditingInstrument(null);
        }}
        onSave={admin.handleSaveInstrument}
      />
      <RetireInstrumentModal
        instrument={admin.removingInstrument}
        onClose={() => admin.setRemovingInstrument(null)}
        onConfirm={admin.handleExecuteRemoveInstrument}
      />
      <DeleteInstrumentModal
        instrument={admin.deletingInstrument}
        isDeleting={admin.isDeletingInstrument}
        onClose={() => {
          admin.setDeletingInstrument(null);
          admin.setDeleteConfirmChecked(false);
        }}
        onConfirm={admin.handleExecuteDeleteInstrument}
      />
      <BookOnBehalfModal
        user={admin.bookOnBehalfUser}
        instrumentsList={admin.instrumentsList}
        onClose={() => admin.setBookOnBehalfUser(null)}
        onSubmit={admin.handleBookOnBehalf}
        onSuccess={() => {
          admin.fetchReservations?.();
          admin.refreshAllStats?.();
        }}
      />
      {admin.isSuperAdmin && (
        <NewAdminModal
          isOpen={admin.showNewAdminModal}
          onClose={() => admin.setShowNewAdminModal(false)}
          onSubmit={admin.handleCreateAdmin}
        />
      )}
      <RejectReasonModal
        modal={admin.rejectModal}
        onClose={() => admin.setRejectModal(null)}
        onUpdateModal={(updated) => admin.setRejectModal(updated)}
        onConfirm={admin.handleConfirmReject}
      />
      <CancelReasonModal
        modal={admin.cancelReasonModal}
        onClose={() => admin.setCancelReasonModal(null)}
        onUpdateModal={(updated) => admin.setCancelReasonModal(updated)}
        onConfirm={admin.handleConfirmBulkCancel}
      />
      <AdminConfirmModal
        modal={admin.confirmModal}
        onClose={() => admin.setConfirmModal(null)}
      />
      <PromoteUserModal
        modal={admin.promoteModal}
        onClose={() => admin.setPromoteModal(null)}
        onSelectRole={(role) =>
          admin.setPromoteModal((prev: any) => (prev ? { ...prev, role } : null))
        }
        onConfirm={(role) => admin.executePromoteUser(role)}
      />
      <HandoverSheetModal
        isOpen={admin.showHandoverModal}
        onClose={() => admin.setShowHandoverModal(false)}
        defaultDate={admin.handoverDefaultDate}
        defaultMode={admin.handoverDefaultMode}
        defaultFormat={admin.handoverDefaultFormat}
      />
      {admin.internalSelectedUserId && (
        <UserDetailModal
          userId={admin.internalSelectedUserId}
          entityType={admin.internalSelectedEntityType}
          isOpen={Boolean(admin.internalSelectedUserId)}
          onClose={() => admin.setInternalSelectedUserId(null)}
          onSelectReservation={(resId) => {
            admin.setInternalSelectedUserId(null);
            if (onOpenReservationDetail) {
              onOpenReservationDetail(resId);
            }
          }}
          isSuperAdmin={admin.isSuperAdmin}
          sessionToken={admin.sessionToken}
          onUserUpdated={() => {
            admin.fetchUsers();
            admin.fetchApprovals();
            admin.refreshAllStats();
            if (admin.isSuperAdmin) admin.fetchAdmins();
          }}
          onPromoteUser={admin.handleOpenPromoteModal}
          onDeleteUser={admin.handleDeleteUser}
          onBookOnBehalf={(userData) => {
            admin.setInternalSelectedUserId(null);
            admin.setBookOnBehalfUser(userData);
          }}
        />
      )}
      {admin.assignModal?.isOpen && admin.assignModal.reservation && (
        <AssignInstrumentModal
          isOpen={admin.assignModal.isOpen}
          reservation={admin.assignModal.reservation}
          onClose={() => admin.setAssignModal(null)}
          onSuccess={() => {
            admin.showNotice("Gear allocated and reservation approved successfully!");
            admin.fetchReservations();
            admin.refreshAllStats();
          }}
        />
      )}
    </>
  );
};
