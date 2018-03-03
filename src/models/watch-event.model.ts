
export interface WatchEvent<T> {

  collection: string;
  type: WatchEventType;
  path: string;
  ids: { [key: string]: any };
  model?: T ;
}

export enum WatchEventType {

  UPDATED = "UPDATED",
  DELETED = "DELETED"

}
