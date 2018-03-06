import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import * as winston from "winston";
import {getIdsFromPath, pathJoin} from "../helpers/model.helper";
import { WatchEvent, WatchEventType } from "../models/watch-event.model";
import { Repository } from "./repository";

const store = new Map();
const watchers: { [name: string]: Array<Observer<WatchEvent<any>>> } = {};

export class MemoryRepository<T> extends Repository<T> {

  public async count(path: string): Promise<number> {
    let p = this.getPath(path);
    let folder = this.getFolder(p);
    if (!folder) {
      return null;
    } else {
      return folder.size;
    }
  }

  public getAll(path: string): Observable<T> {
    return new Observable(observer => {
      let p = this.getPath(path);
      let folder = this.getFolder(p);

      if (!folder) {
        observer.complete();
      }
      for (let key in folder) {
        if (folder[key]) {
          observer.next(folder[key]);
        }
      }
      observer.complete();
    });
  }

  public async getOne(path: string): Promise<T> {
    let p = this.getPath(path);
    let folder = this.getFolder(p);
    if (!folder) {
      return null;
    }
    let segments = p.split("/");
    let file = folder[segments[segments.length - 1]];
    return file || null;
  }

  public watchAll(path: string): Observable<WatchEvent<T>> {
    return Observable.create(observer => {
      let p = this.getPath(path);
      let ws = watchers[p];
      if (!ws) {
        ws = [];
        watchers[p] = ws;
      }
      ws.push(observer);
    });
  }

  public watchOne(path: string): Observable<WatchEvent<T>> {
    return Observable.create(observer => {
      let p = this.getPath(path);
      let ws = watchers[p];
      if (!ws) {
        ws = [];
        watchers[p] = ws;
      }
      ws.push(observer);
    });
  }

  public async save(path: string, model: T): Promise<T> {
    let p = this.getPath(path);
    let folder = this.createFolder(p);
    let segments = p.split("/");
    let name = segments[segments.length - 1];
    folder[name] = model;

    let removePaths: string[] = [];
    for (let watcherPath in watchers) {
      if (p.indexOf(watcherPath) === 0) {
        let ws = watchers[watcherPath];
        let removeWatchers: Array<Observer<any>> = [];
        if (ws) {
          ws.forEach(watcher => {
            try {
              watcher.next({
                type: WatchEventType.UPDATED,
                path: p,
                ids: getIdsFromPath(this.collection, path),
                model,
                collection: this.name
              });
            } catch (e) {
              winston.error(e);
              removeWatchers.push(watcher);
            }
          });
          removeWatchers.forEach(watcher => {
            let index = ws.indexOf(watcher);
            ws.splice(index, 1);
          });
          if (ws.length === 0) {
            removePaths.push(watcherPath);
          }
        }
      }
    }
    removePaths.forEach(watcherPath => {
      delete watchers[watcherPath];
    });

    return model;
  }

  public async delete(path: string): Promise<boolean> {
    let p = this.getPath(path);
    let folder = this.createFolder(p);
    let segments = path.split("/");
    let name = segments[segments.length - 1];
    if (!folder[name]) {
      return false;
    }
    delete folder[name];

    let removePaths: string[] = [];
    for (let watcherPath in watchers) {
      if (p.indexOf(watcherPath) === 0) {
        let ws = watchers[path];
        let removeWatchers: Array<Observer<any>> = [];
        ws.forEach(watcher => {
          try {
            watcher.next({
              type: WatchEventType.UPDATED,
              path: p,
              ids: getIdsFromPath(this.collection, path),
              collection: this.name
            });
          } catch (e) {
            winston.error(e);
            removeWatchers.push(watcher);
          }
        });
        removeWatchers.forEach(watcher => {
          let index = ws.indexOf(watcher);
          ws.splice(index, 1);
        });
        if (ws.length === 0) {
          removePaths.push(watcherPath);
        }
      }
    }
    removePaths.forEach(watcherPath => {
      delete watchers[watcherPath];
    });

    return true;
  }

  private getPath(path: string) {
    return pathJoin(this.name, path);
  }

  private getFolder(path: string): Map<string, any> | null {
    let segments = path.split("/");
    let scope = store;
    if (segments.length > 1) {
      for (let i = 0; i < segments.length - 1; i++) {
        let segment = segments[i];
        if (segment) {
          if (scope[segment]) {
            scope = scope[segment];
          } else {
            return null;
          }
        }
      }
    }
    return scope;
  }

  private createFolder(path: string): Map<string, any> {
    let segments = path.split("/");
    let scope = store;
    if (segments.length > 1) {
      for (let i = 0; i < segments.length - 1; i++) {
        let segment = segments[i];
        if (segment) {
          if (scope[segment]) {
            scope = scope[segment];
          } else {
            let s = new Map();
            scope[segment] = s;
            scope = s;
          }
        }
      }
    }
    return scope;
  }

}
