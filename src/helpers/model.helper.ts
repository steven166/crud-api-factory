import {CollectionModel} from "../models/collection.model";
import {SearchOptions} from "../models/search-options.model";

/**
 * Get Rest Path for a collection
 * @param {string} basePath
 * @param {CollectionModel} collection
 * @returns {string}
 */
export function getPath(basePath: string, collection: CollectionModel, format: string = "express"): string {
  if (collection.parent) {
    let parentPath = getPath(basePath, collection.parent, format);
    let idName = collection.parent.name.substring(0, collection.parent.name.length - 1) + "Id";
    if (format === "express") {
      return `${parentPath}/:${idName}/${collection.name}`;
    } else {
      return `${parentPath}/{${idName}}/${collection.name}`;
    }
  } else {
    return `${basePath}/${collection.name}`;
  }
}

/**
 * Get index fields of a collection
 * @param {Collection} collection
 * @returns {string[]}
 */
export function getIndexFields(collection: CollectionModel): string[] {
  if (collection.parent) {
    let fields = this.getIndexFields(collection.parent);
    let idName = collection.parent.name.substring(0, collection.parent.name.length - 1) + "Id";
    fields.push(idName);
    return fields;
  } else {
    return [];
  }
}

/**
 * Get Ids from path
 * @param {CollectionModel} collection
 * @param {string} path
 * @returns {{[field: string]: string}}
 */
export function getIdsFromPath(collection: CollectionModel, path: string): { [field: string]: string } {
  let segments = path.split("/");
  let fields: { [field: string]: string } = {
    _id: segments[segments.length - 1]
  };
  if (collection.parent) {
    let subpath = segments.splice(segments.length - 1, 1).join("/");
    let subFields = getIdsFromPath(collection.parent, subpath);
    for (let field in subFields) {
      if (subFields[field]) {
        if (field === "_id") {
          fields[getCollectionIdName(collection.parent)] = subFields[field];
        } else {
          fields[field] = subFields[field];
        }
      }
    }
  }
  
  return fields;
}

/**
 * Check if model matches field selectors
 * @param model
 * @param {{[p: string]: string}} fields
 * @returns {boolean}
 */
export function matches(model: any, fields: { [field: string]: string }): boolean {
  for (let field in fields) {
    if (fields[field]) {
      if (model[field] !== fields[field]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Find model by field selectors in list
 * @param {any[]} modelList
 * @param {{[p: string]: string}} fields
 * @returns {any}
 */
export function findItem(modelList: any[], fields: { [field: string]: string }): any {
  return modelList.filter(model => matches(model, fields))[0];
}

/**
 * Get parent id fields
 * @param {CollectionModel} collection
 * @param {{[p: string]: string}} fields
 * @returns {{[p: string]: string}}
 */
export function getParentMatcher(collection: CollectionModel,
                                 fields: { [field: string]: string }): { [field: string]: string } {
  let cloneFields = {...fields};
  if (collection.parent) {
    let fieldName = getCollectionIdName(collection);
    cloneFields._id = cloneFields[fieldName];
    delete cloneFields[fieldName];
    return cloneFields;
  }
  return null;
}

/**
 * Get single collection name
 * @param {CollectionModel} collection
 * @returns {string}
 */
export function getSingleCollectionName(collection: CollectionModel): string {
  return collection.name.substring(0, collection.name.length - 1);
}

/**
 * Get collection id field name
 * @param {CollectionModel} collection
 * @returns {string}
 */
export function getCollectionIdName(collection: CollectionModel): string {
  return getSingleCollectionName(collection) + "Id";
}

export function pathJoin(p1: string, p2: string): string {
  while (p1.endsWith("/")) {
    p1 = p1.substring(0, p1.length - 1);
  }
  while (p2.startsWith("/")) {
    p2 = p2.substring(1);
  }
  return p1 + "/" + p2;
}


/**
 * Get Rest path of resource
 * @param collection
 * @param {SearchOptions} searchOptions
 * @returns {string}
 */
export function getRestPath(collection: CollectionModel, searchOptions: SearchOptions): string {
  let path = "";
  if (collection.parent) {
    path += getRestPath(collection.parent, searchOptions);
  }
  path += `/${collection.name}`;
  let fieldName = getCollectionIdName(collection);
  if (searchOptions.selector[fieldName]) {
    path += `/${searchOptions.selector[fieldName]}`;
  }
  
  return path;
}
