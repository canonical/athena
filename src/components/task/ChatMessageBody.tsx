const preferredFieldOrder = [`achieved`, `summary`, `output`, `nextContext`, `status`, `blocker`, `reason`] as const;

const toDisplayLabel = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, `$1 $2`)
    .replace(/[_-]+/g, ` `)
    .replace(/^./, (value) => value.toUpperCase());

const toOrderedEntries = (message: string): Array<[string, unknown]> | null => {
  const normalized = message.trim();

  if (!normalized.startsWith(`{`) || !normalized.endsWith(`}`)) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;

    if (!parsed || typeof parsed !== `object` || Array.isArray(parsed)) {
      return null;
    }

    const entries = Object.entries(parsed as Record<string, unknown>);

    if (entries.length === 0) {
      return null;
    }

    return entries.sort(([leftKey], [rightKey]) => {
      const leftOrder = preferredFieldOrder.indexOf(leftKey as (typeof preferredFieldOrder)[number]);
      const rightOrder = preferredFieldOrder.indexOf(rightKey as (typeof preferredFieldOrder)[number]);

      if (leftOrder === -1 && rightOrder === -1) {
        return leftKey.localeCompare(rightKey);
      }

      if (leftOrder === -1) {
        return 1;
      }

      if (rightOrder === -1) {
        return -1;
      }

      return leftOrder - rightOrder;
    });
  } catch {
    return null;
  }
};

const renderFieldValue = (value: unknown) => {
  if (typeof value === `string`) {
    return <p className="athena-chat-message__body">{value}</p>;
  }

  if (typeof value === `number` || typeof value === `boolean`) {
    return <p className="athena-chat-message__body">{String(value)}</p>;
  }

  if (value === null) {
    return <p className="athena-chat-message__body">null</p>;
  }

  return <pre className="athena-json-block athena-chat-message__json">{JSON.stringify(value, null, 2)}</pre>;
};

export function ChatMessageBody({ message }: { message: string }) {
  const entries = toOrderedEntries(message);

  if (!entries) {
    return <p className="athena-chat-message__body">{message}</p>;
  }

  return (
    <dl className="athena-chat-message-fields">
      {entries.map(([key, value]) => (
        <div className="athena-chat-message-field" key={key}>
          <dt className="athena-chat-message-field__label">{toDisplayLabel(key)}</dt>
          <dd className="athena-chat-message-field__value">{renderFieldValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
