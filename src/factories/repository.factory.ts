import { CollectionModel } from "../models/collection.model";
import { Database } from "../repositories/database";

export async function createRepository(model: CollectionModel, db: Database): Promise<CollectionModel> {

  model.db = new db(model);

  return model;
}
