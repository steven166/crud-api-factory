import { Observable } from "rxjs/Observable";
import { CollectionModel } from "../models/collection.model";
import { WatchEvent } from "../models/watch-event.model";

export abstract class Repository<T> {

  public readonly name: string;

  constructor(public readonly collection: CollectionModel<T>) {
    this.name = collection.name;
  }

  public abstract count(path: string): Promise<number>;

  public abstract getAll(path: string): Observable<T>;

  public abstract getOne(path: string): Promise<T>;

  public abstract watchAll(path: string): Observable<WatchEvent<T>>;

  public abstract watchOne(path: string): Observable<WatchEvent<T>>;

  public abstract save(path: string, model: T): Promise<T>;

  public abstract delete(path: string): Promise<boolean>;

}
