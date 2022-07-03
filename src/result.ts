const ERR = Symbol();
const OK = Symbol();

type Err<E> = { readonly tag: typeof ERR; readonly err: E };
type Ok<T> = { readonly tag: typeof OK; readonly ok: T };

export class Result<T, E> {
    private inner: Ok<T> | Err<E>;

    private constructor(x: Ok<T> | Err<E>) {
        this.inner = x;
    }

    static err<T, E>(err: E): Result<T, E> {
        return new Result<T, E>({
            tag: ERR,
            err,
        });
    }

    static ok<T, E>(ok: T): Result<T, E> {
        return new Result<T, E>({
            tag: OK,
            ok,
        });
    }

    static promise<T, E>(x: Result<Promise<T>, E>): Promise<Result<T, E>> {
        if (x.inner.tag === ERR) {
            return Promise.resolve(Result.err<T, E>(x.inner.err));
        } else {
            return x.inner.ok.then((x) => Result.ok(x));
        }
    }

    unwrap(): T {
        if (this.inner.tag === ERR) {
            throw new Error("called .unwrap on Err result variant");
        } else {
            return this.inner.ok;
        }
    }

    unwrapErr(): E {
        if (this.inner.tag === ERR) {
            return this.inner.err;
        } else {
            throw new Error("called .unwrapErr on Ok result variant");
        }
    }

    static collapse<T>(r: Result<T, T>): T {
        if (r.inner.tag === ERR) {
            return r.inner.err;
        } else {
            return r.inner.ok;
        }
    }

    isErr(): boolean {
        if (this.inner.tag === ERR) {
            return true;
        } else {
            return false;
        }
    }

    // unwrap(): T {
    //     if (this.inner === NONE) {
    //         throw new Error("Option.unwrap() called on None variant");
    //     }

    //     return this.inner;
    // }

    // isNone(): boolean {
    //     return this.inner === NONE;
    // }

    // forEach(fn: (x: T) => void): void {
    //     if (this.inner !== NONE) {
    //         fn(this.inner);
    //     }
    // }

    // map<R>(fn: (x: T) => R): Option<R> {
    //     if (this.inner !== NONE) {
    //         return Option.some(fn(this.inner));
    //     } else {
    //         return Option.none();
    //     }
    // }

    mapErr<R>(fn: (x: E) => R): Result<T, R> {
        if (this.inner.tag === ERR) {
            return Result.err(fn(this.inner.err));
        } else {
            return Result.ok(this.inner.ok);
        }
    }

    // or(x: T): T {
    //     if (this.inner === NONE) {
    //         return x;
    //     } else {
    //         return this.inner;
    //     }
    // }
}
