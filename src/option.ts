const SOME = Symbol();

export interface None {
    [SOME]: false;
}

export interface Some<T> {
    [SOME]: true;
    (): T;
}

interface OptionMethods {
    switch<T, R>(this: Option<T>, cases: ((x: T) => Option<R>)[]): Option<R>;
    unwrap<T>(this: Option<T>): T;
    isNone<T>(this: Option<T>): this is None;
    isSome<T>(this: Option<T>): this is Some<T>;
    forEach<T>(this: Option<T>, fn: (x: T) => void): void;
    map<T, R>(this: Option<T>, fn: (x: T) => R): Option<R>;
    flatMap<T, R>(this: Option<T>, fn: (x: T) => Option<R>): Option<R>;
    unwrapOr<T>(this: Option<T>, x: T): T;
}

export type Option<T> = (Some<T> | None) & OptionMethods;

const OptionMethods = {
    switch<T, R>(this: Option<T>, cases: ((x: T) => Option<R>)[]): Option<R> {
        return this.flatMap((x) => {
            for (const c of cases) {
                const r = c(x);

                if (!r.isNone()) {
                    return r;
                }
            }

            return Option.none();
        });
    },

    unwrap<T>(this: Option<T>): T {
        if (!this[SOME]) {
            throw new Error("Option.unwrap() called on None variant");
        }

        return this();
    },

    isNone<T>(this: Option<T>): boolean {
        return !this[SOME];
    },

    isSome<T>(this: Option<T>): boolean {
        return this[SOME];
    },

    forEach<T>(this: Option<T>, fn: (x: T) => void): void {
        if (this[SOME]) {
            fn(this());
        }
    },

    map<T, R>(this: Option<T>, fn: (x: T) => R): Option<R> {
        return this.flatMap((x) => Option.some(fn(x)));
    },

    flatMap<T, R>(this: Option<T>, fn: (x: T) => Option<R>): Option<R> {
        if (this[SOME]) {
            return fn(this());
        } else {
            return Option.none();
        }
    },

    unwrapOr<T>(this: Option<T>, x: T): T {
        if (!this[SOME]) {
            return x;
        } else {
            return this();
        }
    },
};

export const Option = {
    none<T>(): Option<T> {
        return { [SOME]: false, ...OptionMethods };
    },

    some<T>(x: T): Option<T> {
        const some = (() => x) as Some<T>;

        some[SOME] = true;
        Object.assign(some, OptionMethods);

        return some as Option<T>;
    },

    fromUndef<T>(x: T | undefined): Option<T> {
        if (typeof x === "undefined") {
            return Option.none();
        } else {
            return Option.some(x);
        }
    },

    fromFalsy<T>(x: T | null | undefined): Option<T> {
        if (!x) {
            return Option.none();
        } else {
            return Option.some(x);
        }
    },

    fromNullable<T>(x: T | null): Option<T> {
        if (x === null) {
            return Option.none();
        } else {
            return Option.some(x);
        }
    },

    promise<T>(x: Option<Promise<T>>): Promise<Option<T>> {
        if (!x[SOME]) {
            return Promise.resolve(Option.none());
        } else {
            return x().then((x) => Option.some(x));
        }
    },
};
