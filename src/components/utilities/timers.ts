export const delay = async (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
