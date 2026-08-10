import { Button, Icon, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoopEditor } from "./LoopEditor.js";
import { acceptLoopInvite, deleteLoop, rejectLoopInvite } from "./loop.client.js";
import { useLoopList, usePendingLoopInvites } from "./loop.query.js";
import type { Feedback, Loop } from "./loop.schema.js";

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

type LoopListProps = {
  editor?: `create` | `edit`;
  loopId?: string;
};

export function LoopList({ editor, loopId }: LoopListProps) {
  const navigate = useNavigate();
  const { state, reload } = useLoopList();
  const { state: pendingInvitesState, reload: reloadPendingInvites } = usePendingLoopInvites();
  const [busyLoopId, setBusyLoopId] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const openCreateDrawer = () => {
    void navigate({ to: `/loops/create` });
    setFeedback(null);
  };

  const openEditDrawer = (loop: Loop) => {
    void navigate({ to: `/loops/edit/$loopEditorId`, params: { loopEditorId: loop.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: `/` });
  };

  const selectedLoop = state.status === `success` && loopId ? state.loops.find((loop) => loop.id === loopId) : undefined;

  const handleDelete = async (loop: Loop) => {
    const confirmed = window.confirm(`Delete loop "${loop.name}"?`);

    if (!confirmed) {
      return;
    }

    setBusyLoopId(loop.id);
    setFeedback(null);

    try {
      await deleteLoop(loop.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Loop deleted`,
        message: `${loop.name} has been deleted.`,
      });

      if (editor === `edit` && loopId === loop.id) {
        closeDrawer();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete loop`,
        message,
      });
    } finally {
      setBusyLoopId(null);
    }
  };

  const handleAcceptInvite = async (inviteId: string, loopName: string, loopId: string) => {
    setBusyInviteId(inviteId);
    setFeedback(null);

    try {
      await acceptLoopInvite(inviteId);
      reload();
      reloadPendingInvites();
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Invite accepted`,
        message: `You have joined ${loopName}.`,
      });
      void navigate({ to: `/loop/$loopId/task/list`, params: { loopId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to accept invite`,
        message,
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleRejectInvite = async (inviteId: string, loopName: string) => {
    setBusyInviteId(inviteId);
    setFeedback(null);

    try {
      await rejectLoopInvite(inviteId);
      reloadPendingInvites();
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Invite rejected`,
        message: `Invite to ${loopName} has been rejected.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to reject invite`,
        message,
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  const loopRows =
    state.status === `success`
      ? state.loops.map((loop) => ({
          key: `loop-${loop.id}`,
          name: (
            <Link params={{ loopId: loop.id }} to={`/loop/$loopId/task/list`}>
              {loop.name}
            </Link>
          ),
          description: loop.description ?? `-`,
          membership: loop.currentUserIsAdmin ? `Admin` : `Member`,
          updatedAt: formatTimestamp(loop.updatedAt),
          sortAt: new Date(loop.updatedAt).getTime(),
          actions: loop.currentUserIsAdmin ? (
            <div className="u-align--right">
              <Button appearance="base" aria-label="Edit" hasIcon={true} onClick={() => openEditDrawer(loop)} title="Edit" type="button">
                <i className="p-icon--edit" />
                <span className="u-off-screen">Edit</span>
              </Button>
              <Button
                appearance="base"
                aria-label={busyLoopId === loop.id ? `Deleting` : `Delete`}
                disabled={busyLoopId === loop.id}
                hasIcon={true}
                onClick={() => handleDelete(loop)}
                title={busyLoopId === loop.id ? `Deleting` : `Delete`}
                type="button"
              >
                <Icon aria-hidden="true" className="text-negative" name="delete" />
                <span className="u-off-screen">{busyLoopId === loop.id ? `Deleting` : `Delete`}</span>
              </Button>
            </div>
          ) : (
            `-`
          ),
        }))
      : [];

  const inviteRows =
    pendingInvitesState.status === `success`
      ? pendingInvitesState.invites.map((invite) => ({
          key: `invite-${invite.id}`,
          name: invite.loopName,
          description: `Invited by ${invite.invitedByName || invite.invitedBy}`,
          membership: `Invited`,
          updatedAt: formatTimestamp(invite.createdAt),
          sortAt: new Date(invite.createdAt).getTime(),
          actions: (
            <div className="u-align--right">
              <Button
                appearance="base"
                aria-label={busyInviteId === invite.id ? `Accepting invite` : `Accept invite`}
                disabled={busyInviteId === invite.id}
                hasIcon={true}
                onClick={() => handleAcceptInvite(invite.id, invite.loopName, invite.loop)}
                title={busyInviteId === invite.id ? `Accepting invite` : `Accept invite`}
                type="button"
              >
                <span aria-hidden="true">&#10003;</span>
                <span className="u-off-screen">{busyInviteId === invite.id ? `Accepting invite` : `Accept invite`}</span>
              </Button>
              <Button
                appearance="base"
                aria-label={busyInviteId === invite.id ? `Rejecting invite` : `Reject invite`}
                disabled={busyInviteId === invite.id}
                hasIcon={true}
                onClick={() => handleRejectInvite(invite.id, invite.loopName)}
                title={busyInviteId === invite.id ? `Rejecting invite` : `Reject invite`}
                type="button"
              >
                <span aria-hidden="true">&#10005;</span>
                <span className="u-off-screen">{busyInviteId === invite.id ? `Rejecting invite` : `Reject invite`}</span>
              </Button>
            </div>
          ),
        }))
      : [];

  const combinedRows = [...loopRows, ...inviteRows].sort((a, b) => b.sortAt - a.sortAt);

  return (
    <section className="u-no-max-width">
      {state.status === `loading` ? <p className="p-text--default">Loading loops...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loops">
          {state.message}
        </Notification>
      ) : null}
      <div className="p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-12 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create
              </Button>
            </div>
          </div>
        </div>
        <h2 className="p-heading--4">Loops</h2>
        {pendingInvitesState.status === `loading` ? <p className="p-text--default">Loading pending invites...</p> : null}
        {pendingInvitesState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load pending invites">
            {pendingInvitesState.message}
          </Notification>
        ) : null}

        {combinedRows.length > 0 ? (
          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `Name` }, { content: `Description` }, { content: `Membership` }, { content: `Updated at` }, { content: `Actions`, className: `u-align--right` }]}
            rows={combinedRows.map((row) => ({
              key: row.key,
              columns: [{ content: row.name }, { content: row.description }, { content: row.membership }, { content: row.updatedAt }, { content: row.actions }],
            }))}
          />
        ) : state.status === `success` && pendingInvitesState.status === `success` ? (
          <p className="p-text--default">No loops yet.</p>
        ) : null}
      </div>
      <EntityDrawer isOpen={editor === `create` || editor === `edit`} onClose={closeDrawer} title={editor === `edit` ? `Edit loop` : `Create loop`}>
        {editor === `edit` && !selectedLoop ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Loop not found">
            The selected loop no longer exists.
          </Notification>
        ) : (
          <LoopEditor
            loop={editor === `edit` ? selectedLoop : undefined}
            onSuccess={(nextFeedback: Feedback) => {
              setFeedback(nextFeedback);
              closeDrawer();
              reload();
            }}
          />
        )}
      </EntityDrawer>
    </section>
  );
}
