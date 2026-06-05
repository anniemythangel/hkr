let counter = 0;

export const nanoid = () => `id-${Date.now().toString(36)}-${(counter++).toString(36)}`;
