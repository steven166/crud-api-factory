
import { Scope } from "../models/scope.model";

export type PostDeleteHook<T = any> = (id: string, scope: Scope) => Promise<void>;
