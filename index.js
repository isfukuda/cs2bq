/**
 * Copyright 2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *
 */

'use strict';

// @param {DATASET} BigQuery DataSet ID
// @param {TABLE}   BigQuery Table Name
const config = require('./config.json');

// Get a reference to the Cloud Storage component
const storage = require('@google-cloud/storage')();
// Get a reference to the BigQuery component
const bigquery = require('@google-cloud/bigquery')();

/**
 * Helper method to get a handle on a BigQuery table. Automatically creates the
 * dataset and table if necessary.
 */
function getTable () {
  const dataset = bigquery.dataset(config.DATASET);

  return dataset.get({ autoCreate: true })
    .then(([dataset]) => dataset.table(config.TABLE).get({ autoCreate: true }));
}

// [START functions_jsonLoad]
/**
 * Cloud Function triggered by Cloud Storage when a file is uploaded.
 *
 * @param {object} event The Cloud Functions event.
 * @param {object} event.data A Cloud Storage file object.
 * @param {string} event.data.bucket Name of the Cloud Storage bucket.
 * @param {string} event.data.name Name of the file.
 * @param {string} [event.data.timeDeleted] Time the file was deleted if this is a deletion event.
 * @see https://cloud.google.com/storage/docs/json_api/v1/objects#resource
 */

exports.jsonLoad = function jsonLoad (event) {
  const file = event.data;

  if (file.resourceState === 'not_exists') {
    // This was a deletion event, we don't want to process this
    return;
  }

  return Promise.resolve()
    .then(() => {
      if (!file.bucket) {
        throw new Error('Bucket not provided. Make sure you have a "bucket" property in your request');
      } else if (!file.name) {
        throw new Error('Filename not provided. Make sure you have a "name" property in your request');
      }

      return getTable();
    })
    .then(([table]) => {
      const fileObj = storage.bucket(file.bucket).file(file.name);
      console.log(`Starting job for ${file.name}`);
      const metadata = {
        autodetect: true,
        allow_field_addition: true,
        allow_field_relaxation: true,
        sourceFormat: 'NEWLINE_DELIMITED_JSON'
      };
      return table.import(fileObj, metadata);
    })
    .then(([job]) => job.promise())
    .then(() => console.log(`Job complete for ${file.name}`))
    .catch((err) => {
      console.log(`Job failed for ${file.name}`);
      return Promise.reject(err);
    });
};
