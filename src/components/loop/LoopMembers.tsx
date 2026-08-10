import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFormik } from "formik";
import { useMemo, useState } from "react";
import { createLoopInvite, revokeLoopInvite, updateLoopMemberAdmin } from "./loop.client.js";
import { useLoopMembership } from "./loop.query.js";
import type { LoopInviteCreate, LoopMembersProps } from "./loop.schema.js";

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

export function LoopMembers({ loopId, onFeedback }: LoopMembersProps) {
  const { state, reload } = useLoopMembership(loopId);
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);
  const [busyMemberUser, setBusyMemberUser] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const membership = state.status === `success` ? state.membership : null;
  const members = membership?.members ?? [];
  const pendingInvites = membership?.pendingInvites ?? [];
  const currentUserIsAdmin = membership?.currentUserIsAdmin ?? false;

  const adminCount = useMemo(() => members.filter((member) => member.isAdmin).length, [members]);

  const inviteFormik = useFormik<LoopInviteCreate>({
    initialValues: { email: `` },
    onSubmit: async (values, helpers) => {
      setIsSubmittingInvite(true);
      onFeedback(null);

      try {
        await createLoopInvite(loopId, values);
        setIsInviteDrawerOpen(false);
        helpers.resetForm();
        reload();
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Invite created`,
          message: `Pending invite for ${values.email} created successfully.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to create invite`,
          message,
        });
      } finally {
        setIsSubmittingInvite(false);
      }
    },
  });

  const handleRoleUpdate = async (user: string, isAdmin: boolean) => {
    setBusyMemberUser(user);
    onFeedback(null);

    try {
      await updateLoopMemberAdmin(loopId, { user, isAdmin });
      reload();
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Member updated`,
        message: `${user} is now ${isAdmin ? `an admin` : `a member`}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update member`,
        message,
      });
    } finally {
      setBusyMemberUser(null);
    }
  };

  const handleInviteRevoke = async (inviteId: string, invitedEmail: string) => {
    setBusyInviteId(inviteId);
    onFeedback(null);

    try {
      await revokeLoopInvite(loopId, inviteId);
      reload();
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Invite revoked`,
        message: `Invite for ${invitedEmail} has been revoked.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to revoke invite`,
        message,
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  return (
    <section className="u-no-max-width">
      <h2 className="p-heading--4">Loop members</h2>

      {state.status === `loading` ? <p className="p-text--default">Loading members...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load members">
          {state.message}
        </Notification>
      ) : null}

      {state.status === `success` ? (
        <>
          <div className="u-align--right" style={{ marginBottom: `1rem` }}>
            {currentUserIsAdmin ? (
              <Button appearance="positive" onClick={() => setIsInviteDrawerOpen(true)} type="button">
                Invite member
              </Button>
            ) : null}
          </div>

          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `User` }, { content: `Role` }, { content: `Joined at` }, { content: `Actions`, className: `u-align--right` }]}
            rows={members.map((member) => {
              const canDemote = member.isAdmin && adminCount > 1;
              const isBusy = busyMemberUser === member.user;

              return {
                key: member.user,
                columns: [
                  {
                    content: (
                      <div>
                        <strong>{member.name || member.user}</strong>
                        {member.name && member.name !== member.user ? <p className="p-text--small">{member.user}</p> : null}
                      </div>
                    ),
                  },
                  { content: member.isAdmin ? `Admin` : `Member` },
                  { content: formatTimestamp(member.createdAt) },
                  {
                    content: currentUserIsAdmin ? (
                      <div className="u-align--right">
                        {member.isAdmin ? (
                          <Button appearance="base" disabled={!canDemote || isBusy} onClick={() => handleRoleUpdate(member.user, false)} type="button">
                            Demote
                          </Button>
                        ) : (
                          <Button appearance="base" disabled={isBusy} onClick={() => handleRoleUpdate(member.user, true)} type="button">
                            Promote
                          </Button>
                        )}
                      </div>
                    ) : (
                      `-`
                    ),
                  },
                ],
              };
            })}
          />

          <h3 className="p-heading--5" style={{ marginTop: `2rem` }}>
            Pending invites
          </h3>

          {pendingInvites.length === 0 ? <p className="p-text--default">No pending invites for this loop.</p> : null}

          {pendingInvites.length > 0 ? (
            <MainTable
              className="u-table-layout--auto"
              headers={[{ content: `Invited email` }, { content: `Invited by` }, { content: `Created at` }, { content: `Actions`, className: `u-align--right` }]}
              rows={pendingInvites.map((invite) => ({
                key: invite.id,
                columns: [
                  { content: invite.invitedEmail },
                  { content: invite.invitedByName || invite.invitedBy },
                  { content: formatTimestamp(invite.createdAt) },
                  {
                    content: currentUserIsAdmin ? (
                      <div className="u-align--right">
                        <Button appearance="base" disabled={busyInviteId === invite.id} onClick={() => handleInviteRevoke(invite.id, invite.invitedEmail)} type="button">
                          Revoke
                        </Button>
                      </div>
                    ) : (
                      `-`
                    ),
                  },
                ],
              }))}
            />
          ) : null}
        </>
      ) : null}

      <EntityDrawer isOpen={isInviteDrawerOpen} onClose={() => setIsInviteDrawerOpen(false)} title="Invite member">
        <form onSubmit={inviteFormik.handleSubmit}>
          <label className="p-form__label" htmlFor="invite-email">
            Email
          </label>
          <input className="p-form-validation__input" id="invite-email" name="email" onBlur={inviteFormik.handleBlur} onChange={inviteFormik.handleChange} placeholder="member@example.com" type="email" value={inviteFormik.values.email} />

          <div className="u-align--right" style={{ marginTop: `1rem` }}>
            <Button appearance="positive" disabled={isSubmittingInvite} type="submit">
              {isSubmittingInvite ? `Inviting...` : `Send invite`}
            </Button>
          </div>
        </form>
      </EntityDrawer>
    </section>
  );
}
