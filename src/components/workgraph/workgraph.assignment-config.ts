export const defaultWorkOnLabel = `athena-start`;
export const defaultWorkDoneLabel = `athena-done`;
export const defaultWorkInProgressLabel = `athena-wip`;

export const readWorkOnLabelFromAssignmentConfig = (value: unknown): string => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return defaultWorkOnLabel;
  }

  const raw = (value as Record<string, unknown>).workOnLabel;
  return typeof raw === `string` && raw.trim().length > 0 ? raw.trim() : defaultWorkOnLabel;
};

export const readWorkDoneLabelFromAssignmentConfig = (value: unknown): string => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return defaultWorkDoneLabel;
  }

  const raw = (value as Record<string, unknown>).workDoneLabel;
  return typeof raw === `string` && raw.trim().length > 0 ? raw.trim() : defaultWorkDoneLabel;
};

export const readWorkInProgressLabelFromAssignmentConfig = (value: unknown): string => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return defaultWorkInProgressLabel;
  }

  const raw = (value as Record<string, unknown>).workInProgressLabel;
  return typeof raw === `string` && raw.trim().length > 0 ? raw.trim() : defaultWorkInProgressLabel;
};
