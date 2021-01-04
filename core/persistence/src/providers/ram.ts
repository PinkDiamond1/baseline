import { IPersistenceService } from "..";

// taken from https://stackoverflow.com/questions/10776600/testing-for-equality-of-regular-expressions
// however, regexp can be nested?
const regexpEqual = (x, y) => {
  return (x instanceof RegExp) && (y instanceof RegExp) &&
         (x.source === y.source) && (x.global === y.global) &&
         (x.ignoreCase === y.ignoreCase) && (x.multiline === y.multiline);
}

export class RAM implements IPersistenceService {

  private config: any;
  // in-memory system of record
  private records: { [identifier: string]: any } = {};
  // track subscribed fields
  private subscribedIdentifiers: string[] = [];
  private subscribedExpressions: RegExp[] = [];

  constructor(config: any) {
    this.config = config;
  }

  // log alerts for subscribed fields
  // params.alerts is array of objects with identifier and an optional message
  alert(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let expression;
      if (this.subscribedExpressions.length > 0) {
        expression = new RegExp(this.subscribedExpressions.join('|'), 'i');
      }

      params.alerts.forEach(a => {
        if (!a.identifier) {
          reject('alert has no identifier');
        }
        if ((this.subscribedIdentifiers.includes(a.identifier) || (expression && expression.test(a.identifier))) && this.records[a.identifier]) {
          // alert for subscribed fields?
          const record = this.records[a.identifier];
          console.log(`Alert for record with ${a.identifier}: ${JSON.stringify(record)}`);
          if (a.message && (typeof a.message == 'string' || a.message instanceof String)) {
            // optional message
            console.log(a.message);
          }
        }
      })
      resolve(params.alerts);
    });
  }

  // subscribe to specific fields via identifiers and RegExp
  // params.fields refers to the set or subset of core/types/persistence Model.fields with type string | string[] | RegExp
  // maybe pass Model per params?
  subscribe(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (params.fields instanceof RegExp) {
        let skip = false;
        for(let i = 0; i < this.subscribedExpressions.length; i++) {
          skip = regexpEqual(this.subscribedExpressions[i], params.fields);
          if (skip) {
            break;
          }
        }
        if (!skip) {
          this.subscribedExpressions.push(params.fields);
        }
      } else if (typeof params.fields == 'string' || params.fields instanceof String) {
        if (!this.subscribedIdentifiers.includes(params.fields)) {
          this.subscribedIdentifiers.push(params.fields);
        }
      } else if (Array.isArray(params.fields) && params.fields.every(e => (typeof e == 'string' || e instanceof String)) && params.fields.length > 0) {
        params.fields.forEach(field => {
          if (!this.subscribedIdentifiers.includes(field)) {
            this.subscribedIdentifiers.push(field);
          }
        });
      } else {
        reject('params.fields is not of type string | string[] | RegExp');
      }
      resolve({
        identifiers: this.subscribedIdentifiers,
        expressions: this.subscribedExpressions
      });
    });
  }

  // unsubscribe to specific fields via identifiers and RegExp
  // params.fields refers to the set or subset of core/types/persistence Model.fields with type string | string[] | RegExp
  // maybe pass Model.fields per params?
  unsubscribe(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (params.fields instanceof RegExp) {
        for(let i = 0; i < this.subscribedExpressions.length; i++) {
          if (regexpEqual(this.subscribedExpressions[i], params.fields)) {
            this.subscribedExpressions.splice(i, 1);
          }
        }
      } else if (typeof params.fields == 'string' || params.fields instanceof String) {
        const index = this.subscribedIdentifiers.indexOf(params.fields);
        if (index !== -1) {
          this.subscribedIdentifiers.splice(index, 1);
        }
      } else if (Array.isArray(params.fields) && params.fields.every(e => (typeof e == 'string' || e instanceof String)) && params.fields.length > 0) {
        params.fields.forEach(field => {
          const index = this.subscribedIdentifiers.indexOf(field);
          if (index !== -1) {
            this.subscribedIdentifiers.splice(index, 1);
          }
        });
      } else {
        reject('params.fields is not of type string | string[] | RegExp');
      }
      resolve({
        identifiers: this.subscribedIdentifiers,
        expressions: this.subscribedExpressions
      });
    });
  }

  // records to be published to ram
  // assume params.records is an array of records to be persisted
  // assume a record of params.records includes at least an identifier
  publish(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      params.records.forEach(record => {
        if (record.identifier) {
          this.records[record.identifier] = record;
        } else {
          reject('record has no identifier');
        }
      });
      resolve(params.records);
    });
  }
}

export async function ramServiceFactory(config?: any): Promise<RAM> {
  return new RAM(config);
}
