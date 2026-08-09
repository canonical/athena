export const readRoleBubbleBackground = (role: string): string => {
  if (role === `user`) {
    return `rgba(36, 116, 196, 0.22)`;
  }

  if (role === `assistant`) {
    return `rgba(45, 158, 122, 0.18)`;
  }

  if (role === `system`) {
    return `rgba(99, 99, 99, 0.18)`;
  }

  return `rgba(139, 97, 196, 0.16)`;
};

export const formatTimestamp = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (segment: number): string => String(segment).padStart(2, `0`);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};
