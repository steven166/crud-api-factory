import { validate } from "jsonschema";
import * as pathUtils from "path";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/toArray";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { getIndexFields } from "./helpers/model.helper";
import { PostDeleteHook } from "./hooks/post-delete.hook";
import { PostUpdateHook } from "./hooks/post-update.hook";
import { PreDeleteHook } from "./hooks/pre-delete.hook";
import { PreUpdateHook } from "./hooks/pre-update.hook";
import { CollectionModel } from "./models/collection.model";
import { Scope } from "./models/scope.model";
import { SearchOptions } from "./models/search-options.model";
import { WatchEvent } from "./models/watch-event.model";

export class Service<T extends any> {

  private postUpdateHooks: PostUpdateHook[] = [];
  private preUpdateHooks: PreUpdateHook[] = [];
  private postDeleteHooks: PostDeleteHook[] = [];
  private preDeleteHooks: PreDeleteHook[] = [];

  constructor(private collection: CollectionModel) {
    collection.service = this;
  }

  /**
   * Count matching results
   * @param {SearchOptions} searchOptions
   * @returns {Promise<number>}
   */
  public getCount(searchOptions: SearchOptions): Promise<number> {
    let prefix = this.getPrefix(searchOptions);
    return this.collection.db.count(prefix);
  }

  /**
   * Get all items as stream
   * @param {SearchOptions} searchOptions
   * @returns {Observable<T>}
   */
  public getAll(searchOptions: SearchOptions): Observable<T> {
    let stream = new Subject<T>();
    try {
      let prefix = this.getPrefix(searchOptions);
      this.checkParent(searchOptions).then(() => {
        this.collection.db.getAll(prefix).subscribe(next => {
          stream.next(next);
        }, error => {
          stream.error(error);
        }, () => {
          stream.complete();
        });
      }).catch(e => {
        stream.error(e);
      });
    } catch (e) {
      stream.error(e);
    }
    return stream;
  }

  /**
   * Watch all items for changes
   * @param {SearchOptions} searchOptions
   * @returns {Observable<T>}
   */
  public watch(searchOptions: SearchOptions): Observable<WatchEvent<T>> {
    let stream = new Subject<WatchEvent<T>>();
    try {
      let prefix = this.getPrefix(searchOptions);
      if (searchOptions.selector._id) {
        prefix += searchOptions.selector._id;
        this.getOne(searchOptions).then(() => {
          this.collection.db.watchOne(prefix).subscribe(next => {
            stream.next(next);
          }, e => stream.error(e));
        }).catch(stream.error);
      } else {
        this.checkParent(searchOptions).then(() => {
          this.collection.db.watchAll(prefix).subscribe(next => {
            stream.next(next);
          }, e => stream.error(e));
        }).catch(e => stream.error(e));
      }

      if (searchOptions.includes) {
        searchOptions.includes.forEach(include => {
          let child = this.collection.children.filter(child => child.name === include)[0];
          if (child) {
            child.service.watch(searchOptions).subscribe(event => {
              stream.next(event);
            }, e => stream.error(e));
          }
        });
      }

    } catch (e) {
      stream.error(e);
    }

    return stream;
  }

  /**
   * Get single item
   * @param {SearchOptions} searchOptions
   * @returns {Observable<T>}
   */
  public async getOne(searchOptions: SearchOptions): Promise<T> {
    let prefix = this.getPrefix(searchOptions);
    let item = await this.collection.db.getOne(prefix + this.safeId(searchOptions.selector._id));
    if (!item) {
      await this.checkParents(searchOptions);
    }
    return item;
  }

  /**
   * Create model
   * @param {T} model
   * @returns {Promise<T>}
   */
  public create(model: T, scope?: Scope): Promise<T | null> {
    return this.update(model, scope);
  }

  /**
   * Insert or update existing model
   * @param {T} model
   * @param scope
   * @returns {Promise}
   */
  public async update(model: T, scope: Scope = {}): Promise<T> {
    for (let hook of this.preUpdateHooks) {
      await hook(model, scope);
    }

    // Create query selector
    let searchOptions: SearchOptions = { selector: {} };
    let indexFields = getIndexFields(this.collection);
    indexFields.forEach(field => {
      if (!model[field]) {
        let name = this.collection.name.substring(0, this.collection.name.length - 1);
        let error: any = new Error(`${name}.${field} is missing`);
        error.status = 400;
        throw error;
      }
      searchOptions.selector[field] = model[field];
    });
    let prefix = this.getPrefix(searchOptions);

    // Validate
    model._id = this.safeId(model._id);
    await this.checkParent(searchOptions);

    if (this.collection.schema) {
      let result = validate(model, this.collection.schema);
      if (!result.valid) {
        let name = this.collection.name.substring(0, this.collection.name.length - 1);
        let error: any = new Error(`${name} not valid`);
        error.errors = result.errors;
        error.status = 400;
        throw error;
      }
    }

    await this.collection.db.save(`${prefix}${model._id}`, model);

    scope.searchOptions = searchOptions;
    for (let hook of this.postUpdateHooks) {
      await hook(model, scope);
    }

    return model;
  }

  /**
   * Delete model
   * @param {SearchOptions} searchOptions
   * @param scope
   * @returns {Promise<boolean>}
   */
  public async delete(searchOptions: SearchOptions, scope?: Scope): Promise<boolean> {
    scope.searchOptions = searchOptions;
    let id = this.safeId(searchOptions.selector._id);
    for (let hook of this.preDeleteHooks) {
      await hook(id, scope);
    }

    let prefix = this.getPrefix(searchOptions);
    let deleted = await this.collection.db.delete(prefix + id);
    if (deleted) {
      for (let hook of this.postDeleteHooks) {
        await hook(id, scope);
      }
      return true;
    }
    await this.checkParents(searchOptions);
    return false;
  }

  /**
   * Check if first parent exists
   * @param {SearchOptions} searchOptions
   * @param parent
   * @return {Promise<boolean>}
   */
  public checkParent(searchOptions: SearchOptions, parent?: CollectionModel): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        let p = parent || this.collection.parent;
        if (p) {
          let name = p.name;
          let options = { ...searchOptions };
          let fields = getIndexFields(p);
          let parentOptions = {};
          fields.forEach(field => {
            parentOptions[field] = options.selector[field];
          });
          parentOptions["_id"] = options.selector[name.substring(0, name.length - 1) + "Id"];
          if (!parentOptions["_id"]) {
            resolve(true);
            return;
          }

          p.service.getOne({ selector: parentOptions }).then(result => {
            if (result) {
              resolve(true);
            } else {
              let error: any = new Error(
                `${name.substring(0, name.length - 1)} '${parentOptions["_id"]}' doesn't exists`);
              error.status = 404;
              reject(error);
            }
          }).catch(error => {
            reject(error);
          });
        } else {
          resolve(false);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Check if all parents exists
   * @param {SearchOptions} searchOptions
   * @return {Promise<boolean>}
   */
  public checkParents(searchOptions: SearchOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.checkParent(searchOptions).then(result => {
          if (this.collection.parent) {
            this.collection.parent.service.checkParents(searchOptions).then(() => {
              resolve(true);
            }).catch(e => {
              reject(e);
            });
          } else {
            resolve(false);
          }
        }).catch(e => {
          reject(e);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  public onPostUpdate(postUpdateHook: PostUpdateHook): void {
    this.postUpdateHooks.push(postUpdateHook);
  }

  public onPreUpdate(preUpdateHook: PreUpdateHook): void {
    this.preUpdateHooks.push(preUpdateHook);
  }

  public onPostDelete(postDeleteHook: PostDeleteHook): void {
    this.postDeleteHooks.push(postDeleteHook);
  }

  public onPreDelete(preDeleteHook: PreDeleteHook): void {
    this.preDeleteHooks.push(preDeleteHook);
  }

  /**
   * Map database model to domain model
   * @param {T} model
   * @returns {T}
   */
  private mapModel(model: T): T {
    if (model) {
      Object.keys(model._id).map(field => {
        return { key: field, value: model._id[field] };
      }).forEach(fieldSet => model[fieldSet.key] = fieldSet.value);
    }
    return model;
  }

  /**
   * Get prefxx of the resource
   * @param {SearchOptions} searchOptions
   * @returns {string}
   */
  private getPrefix(searchOptions: SearchOptions): string {
    let fields = getIndexFields(this.collection);
    let path = "/" + this.collection.name;
    fields.forEach(field => {
      path = pathUtils.join(path, searchOptions.selector[field] || "");
    });
    return path + "/";
  }

  private safeId(id: string): string {
    return encodeURIComponent(id.toLowerCase());
  }

}
