
import { Scope } from "../models/scope.model";

export type PreUpdateHook<T = any> = (item: T, scope: Scope) => Promise<void>;
