/// <reference types="jest" />

import { Result } from "./result";

describe("result", () => {
    test("unwrap on err variant throws", () => {
        expect(() => Result.err("test").unwrap()).toThrow();
    });

    test("unwrap on ok variant succeeds", () => {
        expect(Result.ok("test").unwrap()).toEqual("test");
    });
});
