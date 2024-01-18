export function validateEmail(email: string) {
  const regex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return regex.test(email);
}

export function shallowCompare<
  T extends Record<string, any>,
  U extends (keyof T)[]
>(a: T, b: T, keys?: U) {
  return Object.entries(a)
    .filter(([key]) => keys === undefined || keys.includes(key))
    .every(([key, value]) => value === b[key]);
}

export function extractKeys<
  T extends Record<string, any>,
  U extends (keyof T)[]
>(object: T, keys: U) {
  return Object.entries(object).reduce<Pick<T, U[number]>>(
    (acc, [key, value]) => {
      if (!keys.includes(key)) {
        return acc;
      }

      return {
        ...acc,
        [key]: value,
      };
    },
    {} as T
  );
}
