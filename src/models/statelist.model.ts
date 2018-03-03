import { ReplaySubject } from "rxjs/ReplaySubject";
import * as winston from "winston";
import { Client } from "../client";
import { findItem, getParentMatcher, matches } from "../helpers/model.helper";
import { SearchOptions } from "../models/search-options.model";
import { WatchEventType } from "../models/watch-event.model";

const reconnectTimeout = 5;

export class StateList<T> {

  public readonly stream = new ReplaySubject<T[]>();
  public readonly errorStream = new ReplaySubject<any>();
  public readonly items: T[] = [];
  private _loaded: boolean = false;

  constructor(private client: Client<T>, private searchOptions?: SearchOptions) {
    this.initList();
  }

  public get loaded(): boolean {
    return this._loaded;
  }

  private initList() {
    this.client.getAll(this.searchOptions || {selector: {}}).subscribe(next => {
      this.items.push(next);
    }, error => this.onError(error), () => {
      this._loaded = true;
      this.stream.next(this.items);
      this.startWatch();
    });
  }

  private startWatch() {
    this.client.watch(this.searchOptions).subscribe(event => {
      if (event.collection === this.client.collection.name) {
        if (event.type === WatchEventType.UPDATED) {
          let item = findItem(this.items, event.ids);
          if (item) {
            this.mergeItem(item, event.model, this.searchOptions.includes);
          } else {
            this.items.push(event.model);
          }
          this.stream.next(this.items);
        } else if (event.type === WatchEventType.DELETED) {
          let item = findItem(this.items, event.ids);
          if (item) {
            let index = this.items.indexOf(item);
            if (index > -1) {
              this.items.splice(index, 1);
              this.stream.next(this.items);
            }
          }
        }
      } else if (this.searchOptions.includes && this.searchOptions.includes.indexOf(event.collection) > -1) {
        let collection = this.client.collection.children.filter(child => child.name === event.collection)[0];
        if (collection) {
          if (event.type === WatchEventType.UPDATED) {
            let parentIds = getParentMatcher(collection, event.ids);
            let item = findItem(this.items, parentIds);
            if (!item[collection.name]) {
              item[collection.name] = [];
            }
            let subItem = findItem(item[collection.name], event.ids);
            if (subItem) {
              this.mergeItem(subItem, event.model);
            } else {
              item[collection.name].push(event.model);
            }
            this.stream.next(this.items);
          } else if (event.type === WatchEventType.DELETED) {
            let parentIds = getParentMatcher(collection, event.ids);
            let item = findItem(this.items, parentIds);
            if (item) {
              if (!item[collection.name]) {
                let subItem = findItem(item[collection.name], event.ids);
                if (subItem) {
                  let index = item[collection.name].indexOf(subItem);
                  if (index > -1) {
                    item[collection.name].splice(index, 1);
                    this.stream.next(this.items);
                  }
                }
              }
            }
          }
        }
      }
    }, error => {
      winston.warn(`Watcher ${this.client.collection.name} failed, reconnecting in ${reconnectTimeout}s`);
      setTimeout(() => {
        this.startWatch();
      }, reconnectTimeout * 1000);
    });
  }

  private onError(error: any) {
    this.errorStream.next(error);
  }

  private mergeItem(item: T, overrideItem: T, includes?: string[]): void {
    for (let field in overrideItem) {
      if (overrideItem[field] && (!includes ||
          (includes && includes.indexOf(field) === -1))) {
        item[field] = overrideItem[field];
      }
    }

    for (let field in item) {
      if (item[field] && !overrideItem[field] && (!includes ||
          (includes && includes.indexOf(field) === -1))) {
        delete item[field];
      }
    }
  }

}
