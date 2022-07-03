/// <reference types="jest" />

import { Option } from "./option";

describe("option", () => {
    test("unwrap on none variant throws", () => {
        expect(() => Option.none().unwrap()).toThrow();
    });

    test("unwrap on some variant succeeds", () => {
        expect(Option.some("test").unwrap()).toEqual("test");
    });
});
