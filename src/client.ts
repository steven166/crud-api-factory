import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import * as winston from "winston";
import { getIndexFields } from "./helpers/model.helper";
import { CollectionModel } from "./models/collection.model";
import { SearchOptions } from "./models/search-options.model";
import { WatchEvent } from "./models/watch-event.model";

export class Client<T> {

  constructor(public readonly collection: CollectionModel, private basePath: string = "/api") {
    collection.client = this;
  }

  /**
   * Get all items as stream
   * @param {SearchOptions} searchOptions
   * @returns {Observable<T>}
   */
  public getAll(searchOptions: SearchOptions): Observable<T> {
    let stream = new Subject<T>();
    try {
      let path = this.getPath(searchOptions);
      fetch(path).then(response => {
        response.json().then(json => {
          json.forEach(item => {
            stream.next(item);
          });
          stream.complete();
        }).catch(e => {
          stream.error(e);
        });
      }).catch(e => {
        stream.error(e);
      });
    } catch (e) {
      stream.error(e);
    }
    return stream;
  }

  public watch(searchOptions: SearchOptions): Observable<WatchEvent<T>> {
    let stream = new Subject<WatchEvent<T>>();
    try {
      let path = this.getPath(searchOptions, { watch: "true" });
      fetch(path).then(response => {
        let reader = response.body.getReader();
        let partialResult = "";

        let parse = (value: string) => {
          try {
            let result = JSON.parse(value);
            stream.next(result);
          } catch (e) {
            winston.warn(`Failed to parse: '${value}'. `, e.getMessage());
          }
        };

        let read = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              if (partialResult) {
                parse(partialResult);
              }
              stream.error("complete");
            } else {
              partialResult += value;

              let parts = partialResult.split("\n");
              while (parts.length > 1) {
                let part = parts.splice(0, 1);
                parse(part[0]);
              }
              partialResult = parts[0];

              read();
            }
          }).catch(e => {
            stream.error(e);
          });
        };

        read();
      }).catch(e => {
        stream.error(e);
      });
    } catch (e) {
      stream.error(e);
    }
    return stream;
  }

  /**
   * Get http path
   * @param {SearchOptions} searchOptions
   * @param {{[p: string]: string}} search
   * @returns {string}
   */
  private getPath(searchOptions: SearchOptions, search?: { [key: string]: string }): string {
    let prefix = this.getPrefix(searchOptions);
    let path = `${this.basePath}/${this.collection.version}${prefix}`;
    if (searchOptions.includes) {
      search.includes = searchOptions.includes.join(",");
    }
    if (search) {
      let first = true;
      for (let field in search) {
        if (search[field]) {
          if (first) {
            path += "?";
          } else {
            path += "&";
          }
          path += `${field}=${search[field]}`;
        }
      }
    }
    return path;
  }

  /**
   * Get prefix of the resource
   * @param {SearchOptions} searchOptions
   * @returns {string}
   */
  private getPrefix(searchOptions: SearchOptions): string {
    let fields = getIndexFields(this.collection);
    let path = "/" + this.collection.name;
    fields.forEach(field => {
      let suffix = searchOptions.selector[field] || "";
      if (path.endsWith("/") && suffix.startsWith("/")) {
        path = path + suffix.substring(1);
      } else if (path.endsWith("/") || suffix.startsWith("/")) {
        path = path + suffix;
      } else {
        path = path + "/" + suffix;
      }
    });
    return path + "/";
  }

}
