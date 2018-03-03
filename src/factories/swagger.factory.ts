import { getIndexFields, getPath } from "../helpers/model.helper";
import { CollectionModel } from "../models/collection.model";

const packageJson = loadPackageJson();

const swaggerDoc: any = {
  openapi: "3.0.0",
  info: {
    version: packageJson.version,
    title: "MicroDocs",
    description: packageJson.description,
    license: {
      name: "MIT"
    },
    contact: {
      name: "s.hermans",
      email: "s.hermans@maxxton.com",
      url: "http://microdocs.io"
    },
    servers: [
      {
        url: "https://microdocs.io"
      }],
    paths: {},
    components: {
      schemas: {}
    }
  }
};

const collections: CollectionModel[] = [];

export function createSwaggerEndpoint(express: any) {
  let docs = swaggerDoc;
  collections.forEach(collection => {
    let singleName = collection.name.substring(0, collection.name.length - 1);
    let path = getPath("/api/" + collection.version, collection, "swagger");
    let indexFields = getIndexFields(collection);
    let pathParameters = indexFields.map(field => {
      return {
        name: field,
        in: "path",
        description: field,
        required: true,
        schema: {
          type: "string"
        }
      };
    });
    let getParameters = [];
    if (collection.children.length > 0) {
      getParameters.push({
        name: "includes",
        in: "query",
        description: "Child resources to include in the response",
        required: false,
        schema: {
          type: "string"
        }
      });
    }
    if (!docs.paths) {
      docs.paths = {};
    }
    if (!docs.components) {
      docs.components = {};
    }
    if (!docs.components.schemas) {
      docs.components.schemas = {};
    }
    docs.paths[path] = {};
    docs.paths[path].get = {
      operationId: "Get all " + collection.name,
      description: "Get all " + collection.name,
      parameters: pathParameters.concat(getParameters),
      responses: {
        200: {
          description: collection.name + " response",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/" + collection.name
                }
              }
            }
          }
        }
      }
    };
    if (!collection.readOnly) {
      docs.paths[path].post = {
        operationId: "Create " + singleName,
        description: "Create " + singleName,
        parameters: pathParameters,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/" + collection.name
              }
            }
          }
        }
      };
    }
    docs.paths[path + "/{id}"] = {};
    docs.paths[path + "/{id}"].get = {
      operationId: "Get " + singleName,
      description: "Get " + singleName,
      parameters: pathParameters.concat(getParameters),
      responses: {
        200: {
          description: collection.name + " response",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/" + collection.name
              }
            }
          }
        }
      }
    };
    if (!collection.readOnly) {
      docs.paths[path + "/{id}"].put = {
        operationId: "Edit " + singleName,
        description: "Edit " + singleName,
        parameters: pathParameters,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/" + collection.name
              }
            }
          }
        },
        responses: {
          200: {
            description: collection.name + " response",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/" + collection.name
                }
              }
            }
          }
        }
      };
      docs.paths[path + "/{id}"].delete = {
        operationId: "Delete " + singleName,
        description: "Delete " + singleName,
        parameters: pathParameters,
        responses: {
          204: {
            description: singleName + " is deleted",
          }
        }
      };
    }
    if (collection.schema) {
      docs.components.schemas[collection.name] = collection.schema;
    } else {
      docs.components.schemas[collection.name] = { type: "any" };
    }
  });

  express.get("/api/docs", (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.json(docs);
  });
}

export function createSwaggerDocs(collection: CollectionModel) {
  collections.push(collection);
}

export function loadPackageJson(): any {
  try {
    let fs = require("fs");
    let packageJson: any;
    if (fs.existsSync("../../package.json")) {
      // tslint:disable-next-line
      packageJson = require("../../package.json");
    } else if (fs.existsSync("../../../package.json")) {
      // tslint:disable-next-line
      packageJson = require("../../../package.json");
    } else {
      packageJson = {
        version: "2.0.0"
      };
    }
    return packageJson;
  } catch (e) {
    // do nothing
  }
  return {};
}
