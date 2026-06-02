import type { ZodType } from "zod";

export const extractJsonObject = (response: string) => {
  const firstBraceIndex = response.indexOf(`{`);
  const lastBraceIndex = response.lastIndexOf(`}`);

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    return null;
  }

  return response.slice(firstBraceIndex, lastBraceIndex + 1);
};

export const parseResponse = <T>(response: string, schema: ZodType<T>): T | null => {
  const trimmedResponse = response.trim();

  if (!trimmedResponse) {
    return null;
  }

  const normalizedResponse = trimmedResponse.startsWith(`\`\`\``) ? trimmedResponse.replace(/^```(?:json)?\s*/i, ``).replace(/\s*```$/, ``) : trimmedResponse;
  const jsonResponse = extractJsonObject(normalizedResponse) ?? normalizedResponse;

  try {
    const parsedResponse = schema.safeParse(JSON.parse(jsonResponse));

    return parsedResponse.success ? parsedResponse.data : null;
  } catch {
    return null;
  }
};
