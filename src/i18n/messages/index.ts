import type { Locale } from "../locales";
import type { Messages } from "../translate";
import bn from "./bn";
import gu from "./gu";
import hi from "./hi";
import kn from "./kn";
import ml from "./ml";
import mr from "./mr";
import or from "./or";
import pa from "./pa";
import ta from "./ta";
import te from "./te";

/** Every language's dictionary. Server-only: the browser receives just the current one. */
export const MESSAGES: Record<Locale, Messages> = { en: {}, hi, bn, mr, te, ta, gu, kn, ml, pa, or };
