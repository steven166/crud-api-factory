
import { Scope } from "../models/scope.model";

export type PostUpdateHook<T = any> = (item: T, scope: Scope) => Promise<void>;
