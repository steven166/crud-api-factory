import { Schema } from "jsonschema";
import { Client } from "../client";
import { Service } from "../service";
import { Repository } from "../repositories/repository";

export interface CollectionModel<T = any> {

  name: string;
  parent?: CollectionModel;
  schema?: Schema;
  db?: Repository<T>;
  service?: Service<T>;
  client?: Client<T>;
  children: CollectionModel[];
  readOnly?: boolean;
  version: string;

}
