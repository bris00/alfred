import { Display } from "./display";
import { Landable } from "./land";
import { Searchable } from "./searchable";
export interface Square extends Display, Landable, Searchable {
    square: number;
}
