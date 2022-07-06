/// <reference types="jest" />

import { Option } from "./option";

describe("option", () => {
    test("unwrap on none variant throws", () => {
        expect(() => Option.none().unwrap()).toThrow();
    });

    test("unwrap on some variant succeeds", () => {
        expect(Option.some("test").unwrap()).toEqual("test");
    });

    test("narrowing on none variant", () => {
        const opt = Option.none();
        expect(opt.isNone() ? "NONE" : "SOME").toEqual("NONE");
    });

    test("narrowing on some variant", () => {
        const opt = Option.some("SOME");
        expect(opt.isSome() ? opt() : "NONE").toEqual("SOME");
    });
});
