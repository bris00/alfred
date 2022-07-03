type NonMethodKeys<T> = ({
    // eslint-disable-next-line @typescript-eslint/ban-types
    [P in keyof T]: T[P] extends Function ? never : P;
} & { [x: string]: never })[keyof T];
export type RemoveMethods<T> = Pick<T, NonMethodKeys<T>>;

export function groupOf<T, R, K extends string>(
    constructor: new (_: T) => R,
    key: (_: T) => K,
    list: T[]
): Record<K, R> {
    const group: Record<string, R> = {};

    for (const data of list) {
        group[key(data)] = new constructor(data);
    }

    return group;
}
