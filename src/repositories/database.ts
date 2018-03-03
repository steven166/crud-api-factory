
import { CollectionModel } from "../models/collection.model";
import { Repository } from "./repository";

export type Database = (new (collection: CollectionModel) => Repository<any>);
