/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as answers from "../answers.js";
import type * as candidates from "../candidates.js";
import type * as demo from "../demo.js";
import type * as evidence from "../evidence.js";
import type * as interviews from "../interviews.js";
import type * as jobs from "../jobs.js";
import type * as questions from "../questions.js";
import type * as reports from "../reports.js";
import type * as storage from "../storage.js";
import type * as utils from "../utils.js";
import type * as validators from "../validators.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  answers: typeof answers;
  candidates: typeof candidates;
  demo: typeof demo;
  evidence: typeof evidence;
  interviews: typeof interviews;
  jobs: typeof jobs;
  questions: typeof questions;
  reports: typeof reports;
  storage: typeof storage;
  utils: typeof utils;
  validators: typeof validators;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
