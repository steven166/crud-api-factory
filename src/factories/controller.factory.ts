import "rxjs/add/observable/fromPromise";
import "rxjs/add/operator/mergeMap";
import { Observable } from "rxjs/Observable";
import * as winston from "winston";
import { getCollectionIdName, getPath } from "../helpers/model.helper";
import { CollectionModel } from "../models/collection.model";
import { Scope } from "../models/scope.model";
import { SearchOptions } from "../models/search-options.model";

export function createController(express: any, collection: CollectionModel) {

  winston.info(`Endpoint ${collection.name} ${getPath("/api/" + collection.version, collection)}`);

  express.get(`${getPath("/api/" + collection.version, collection)}`,
    (req: any, res: any, next: any) => {
      // Define search options
      let searchOptions: SearchOptions = {
        selector: {}
      };

      // Create search options
      if (req.params && Object.keys(req.params).length > 0) {
        searchOptions.selector = req.params;
      }

      if (req.query["watch"] !== undefined) {
        let sendHeaders = false;
        let sendError = false;
        collection.service.watch(searchOptions).subscribe(result => {
          if (!sendHeaders) {
            res
              .header("content-type", "application/json")
              .status(200);
            sendHeaders = true;
          }
          res.write(JSON.stringify(result));
          res.write("\n");
        }, error => {
          sendError = true;
          if (error.status === 404) {
            next();
          } else {
            next(error);
          }
        }, () => {
          if (!sendHeaders && !sendError) {
            res
              .header("content-type", "application/json")
              .status(200);
            sendHeaders = true;
          }
          res.end();
        });
      } else {
        let sendHeaders = false;
        let sendError = false;
        collection.service.getAll(searchOptions).flatMap(result => {
          return Observable.fromPromise(includeChilds(collection, { request: req, response: res }, result, result._id));
        }).subscribe(result => {
          if (!sendHeaders) {
            res
              .header("content-type", "application/json")
              .status(200);
            res.write("[");
            sendHeaders = true;
          } else {
            res.write(",");
          }

          res.write(JSON.stringify(result));
        }, error => {
          sendError = true;
          if (error.status === 404) {
            next();
          } else {
            next(error);
          }
        }, () => {
          if (!sendHeaders && !sendError) {
            res
              .header("content-type", "application/json")
              .status(200);
            res.write("[");
            sendHeaders = true;
          }
          res.write("]");
          res.end();
        });
      }
    });

  if (!collection.readOnly) {
    express.post(`${getPath("/api/" + collection.version, collection)}`,
      (req: any, res: any, next: any) => {
        let body = { ...req.body, ...req.params };

        collection.service.create(body, { request: req, response: res }).then(result => {
          res.json(result);
        }).catch(error => {
          next(error);
        });
      });
  }

  express.get(`${getPath("/api/" + collection.version, collection)}/:_id`,
    (req: any, res: any, next: any) => {

      let searchOptions = {
        selector: req.params
      };

      if (req.query.watch !== undefined) {
        // Watch resource
        let sendHeaders = false;
        let sendError = false;
        collection.service.watch(searchOptions).subscribe(result => {
          if (!sendHeaders) {
            res
              .header("content-type", "application/json")
              .status(200);
            sendHeaders = true;
          }
          res.write(JSON.stringify(result));
          res.write("\n");
        }, error => {
          sendError = true;
          if (error.status === 404) {
            next();
          } else {
            next(error);
          }
        }, () => {
          if (!sendHeaders && !sendError) {
            res
              .header("content-type", "application/json")
              .status(200);
            sendHeaders = true;
          }
          res.end();
        });
      } else {
        // Get resource
        collection.service.getOne(searchOptions).then(result => {
          if (result) {
            if (req.query.include) {
              includeChilds(collection, { request: req, response: res }, result).then(includedResult => {
                res.json(includedResult);
              }).catch(e => {
                next(e);
              });
            } else {
              res.json(result);
            }
          } else {
            next();
          }
        }).catch(error => {
          next(error);
        });
      }

    });

  if (!collection.readOnly) {
    express.put(`${getPath("/api/" + collection.version, collection)}/:_id`,
      (req: any, res: any, next: any) => {
        let body = { ...req.body, ...req.params };

        collection.service.update(body, { request: req, response: res }).then(result => {
          res.json(result);
        }).catch(error => {
          next(error);
        });

      });

    express.delete(`${getPath("/api/" + collection.version, collection)}/:_id`,
      (req: any, res: any, next: any) => {

        let searchOptions = {
          selector: req.params
        };

        collection.service.delete(searchOptions, { request: req, response: res }).then(result => {
          if (result) {
            res.status(204).send();
          } else {
            next();
          }
        }).catch(error => {
          next(error);
        });

      });
  }

  express.all(`${getPath("/api/" + collection.version, collection)}`,
    (req: any, res: any, next: any) => {
      methodNotAllowed(["GET", "POST"], req, res, next);
    });

  express.all(`${getPath("/api/" + collection.version, collection)}/:_id`,
    (req: any, res: any, next: any) => {
      methodNotAllowed(["GET", "PUT", "DELETE"], req, res, next);
    });

}

/**
 * Include child collections
 * @param {CollectionModel} collection
 * @param scope
 * @param result
 * @param id
 * @returns {Promise<any>}
 */
async function includeChilds(collection: CollectionModel,
                             scope: Scope,
                             result: any,
                             id?: string): Promise<any> {
  if (scope.request.query.include) {
    let searchOptions: SearchOptions = {
      selector: {}
    };
    Object.keys(scope.request.params).forEach(field => {
      if (field === "_id") {
        searchOptions.selector[getCollectionIdName(collection)] = scope.request.params[field];
      } else {
        searchOptions.selector[field] = scope.request.params[field];
      }
    });
    if (id) {
      searchOptions.selector[getCollectionIdName(collection)] = id;
    }

    await Promise.all(scope.request.query.include.split(",").map(childName => {
      return new Promise<any>((resolve, reject) => {
        let childCollection: CollectionModel = collection.children.filter(
          childCollection => childCollection.name === childName.toLowerCase())[0];
        if (childCollection) {
          let items: any[] = [];
          childCollection.service.getAll(searchOptions).subscribe(item => {
            items.push(item);
          }, error => {
            reject(error);
          }, () => {
            result[childCollection.name] = items;
            resolve();
          });
        } else {
          let error: any = new Error("Unknown collection '" + childName + "'");
          error.status = 400;
          return reject(error);
        }
      });
    }));
  }
  return result;
}

/**
 * Handle method not allowed
 * @param {string[]} methods
 * @param {e.Request} req
 * @param {e.Response} res
 * @param {e.NextFunction} next
 */
function methodNotAllowed(methods: string[], req: any, res: any, next: any) {
  if (methods.indexOf(req.method.toUpperCase()) > -1) {
    next();
  } else {
    let error: any = new Error("Method not allowed");
    try {
      error.status = 405;
      error.allowedMethods = methods;
      throw error;
    } catch (e) {
      next(e);
    }
  }
}
