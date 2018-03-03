import { Schema } from "jsonschema";
import { Client } from "../client";
import { PostDeleteHook } from "../hooks/post-delete.hook";
import { PostUpdateHook } from "../hooks/post-update.hook";
import { PreDeleteHook } from "../hooks/pre-delete.hook";
import { PreUpdateHook } from "../hooks/pre-update.hook";
import { CollectionModel } from "../models/collection.model";
import { Database } from "../repositories/database";
import { Service } from "../service";
import { createController } from "./controller.factory";
import { createRepository } from "./repository.factory";
import { createSwaggerDocs } from "./swagger.factory";

const collections: CollectionModel[] = [];

export function createClientCollection<T>(name: string, options: ModelOptions<T>): CollectionModel<T> {
  let collection: CollectionModel<T> = {
    name,
    schema: options.schema,
    children: [],
    readOnly: options.readOnly || false,
    version: options.version || "v1"
  };
  if (options.parent) {
    let parentCollection = getCollection(options.parent);
    if (!parentCollection) {
      throw new Error("Unknown parent collection: " + options.parent);
    }
    collection.parent = parentCollection;
    parentCollection.children.push(collection);
  }

  collection.client = new Client(collection, options.basePath || "/api");

  collections.push(collection);
  return collection;
}

export async function createServiceCollection<T>(name: string, options: ModelOptions<T>): Promise<CollectionModel<T>> {
  let collection: CollectionModel<T> = {
    name,
    schema: options.schema,
    children: [],
    readOnly: options.readOnly || false,
    version: options.version || "v1"
  };
  if (options.parent) {
    let parentCollection = getCollection(options.parent);
    if (!parentCollection) {
      throw new Error("Unknown parent collection: " + options.parent);
    }
    collection.parent = parentCollection;
    parentCollection.children.push(collection);
  }

  collection.service = new Service(collection);
  if (options.postUpdateHook) {
    collection.service.onPostUpdate(options.postUpdateHook);
  }
  if (options.preUpdateHook) {
    collection.service.onPreUpdate(options.preUpdateHook);
  }
  if (options.postDeleteHook) {
    collection.service.onPostDelete(options.postDeleteHook);
  }
  if (options.preDeleteHook) {
    collection.service.onPreDelete(options.preDeleteHook);
  }

  await createRepository(collection, options.database);
  createController(options.webServer, collection);
  createSwaggerDocs(collection);

  collections.push(collection);
  return collection;
}

export function getCollection<T>(name: string): CollectionModel<T> {
  return collections.filter(c => c.name === name)[0] || null;
}

export interface ModelOptions<T> {

  schema?: Schema;
  parent?: string;
  database?: Database;
  webServer?: any;
  postUpdateHook?: PostUpdateHook;
  preUpdateHook?: PreUpdateHook;
  postDeleteHook?: PostDeleteHook;
  preDeleteHook?: PreDeleteHook;
  readOnly?: boolean;
  version?: string;
  basePath?: string;

}
