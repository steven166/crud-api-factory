
import { Scope } from "../models/scope.model";

export type PreDeleteHook<T = any> = (id: string, scope: Scope) => Promise<void>;
