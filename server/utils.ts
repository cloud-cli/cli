export const pluck = <T extends object>(object: T, list: Array<keyof T>) =>
  list.reduce((o: Partial<T>, p: keyof T) => ((o[p] = object[p]), o), {});
