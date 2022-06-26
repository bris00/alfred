const NONE = Symbol();
type None = typeof NONE;

export class Option<T> {
    private inner: T | None;

    private constructor(x: T | None) {
        this.inner = x;
    }

    static none<T>(): Option<T> {
        return new Option<T>(NONE);
    }

    static some<T>(x: T): Option<T> {
        return new Option<T>(x);
    }

    static fromMaybeUndef<T>(x: T | undefined): Option<T> {
        if (typeof x === "undefined") {
            return Option.none();
        } else {
            return Option.some(x);
        }
    }

    static fromFalsy<T>(x: T | null | undefined): Option<T> {
        if (!x) {
            return Option.none();
        } else {
            return Option.some(x);
        }
    }

    static fromNullable<T>(x: T | null): Option<T> {
        if (x === null) {
            return Option.none();
        } else {
            return Option.some(x);
        }
    }

    static promise<T>(x: Option<Promise<T>>): Promise<Option<T>> {
        if (x.inner === NONE) {
            return Promise.resolve(Option.none());
        } else {
            return x.inner.then((x) => Option.some(x));
        }
    }

    switch<R>(cases: ((x: T) => Option<R>)[]): Option<R> {
        return this.flatMap((x) => {
            for (const c of cases) {
                const r = c(x);

                if (!r.isNone()) {
                    return r;
                }
            }

            return Option.none();
        });
    }

    unwrap(): T {
        if (this.inner === NONE) {
            throw new Error("Option.unwrap() called on None variant");
        }

        return this.inner;
    }

    isNone(): boolean {
        return this.inner === NONE;
    }

    forEach(fn: (x: T) => void): void {
        if (this.inner !== NONE) {
            fn(this.inner);
        }
    }

    map<R>(fn: (x: T) => R): Option<R> {
        return this.flatMap((x) => Option.some(fn(x)));
    }

    flatMap<R>(fn: (x: T) => Option<R>): Option<R> {
        if (this.inner !== NONE) {
            return fn(this.inner);
        } else {
            return Option.none();
        }
    }

    unwrapOr(x: T): T {
        if (this.inner === NONE) {
            return x;
        } else {
            return this.inner;
        }
    }
}
