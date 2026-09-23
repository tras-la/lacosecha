const SHEET_ID = "1l1JdsIleqocV2pNGlSSxGbl7-PzU9QeGh52N9tEQScc"; // shop sheet
const SHEET_GID = "0";
const OG_IMAGE_WIDTH = 600;
const SHEET_TIMEZONE_OFFSET = -3;

/**
 *
 * @param {String} urls, a string containing google drive links separated by commas
 * @returns {String} id of the last google drive link provided
 */
function getFileIdsFromDriveUrls(urls) {
  const imageIdRegexp = /\/d\/([\d\w-]*)\//gm;
  const ids = Array.from(urls.matchAll(imageIdRegexp), (m) => m[1]);
  return ids; // Get the last match
}

/**
 * 
 * @param {String} imageId 
 * @param {Number} width in pixels
 * @returns {String} Image url from a google drive to use in <img>
 
 */
function createGoogleDriveImageUrl(imageId, width = OG_IMAGE_WIDTH) {
  return `https://drive.google.com/thumbnail?sz=w${width}&id=${imageId}`;
}

/**
 *
 * @param {String} imageUrls A comma separated list of google drive urls
 * @returns {String} preview image url for the last file on the list
 * @returns {Array} Preview images urls
 */
function getGoogleDriveImagesPreviews(imageUrls, width = OG_IMAGE_WIDTH) {
  return getFileIdsFromDriveUrls(imageUrls).map((id) =>
    createGoogleDriveImageUrl(id, width),
  );
}

/**
 * Get formatted events from a Google Sheet using its ID and GID.
 *
 * @param {string} id - The ID of the Google Sheet.
 * @param {number} gid - The grid ID of the specific sheet within the Google Sheet.
 * @returns {Promise<Object[]>} A promise that resolves to an array of eventData objects.
 */
async function getGoogleSheetData(id = SHEET_ID, gid = SHEET_GID) {
  const data = await getSheetData(id, gid);
  return data.map((product) => {
    if (product.images) {
      product.images = getGoogleDriveImagesPreviews(product.images);
    }
    return product;
  });
}

/**
 * Creates a Date object based on the date/time components
 * as interpreted in the sheet's timezone.
 *
 * @param {number} year - The full year (e.g., 2023)
 * @param {number} month - The month in 0-index (0-11) (e.g., January is 0)
 * @param {number} day - The day of the month
 * @param {number} hour - The hour (0-23)
 * @param {number} minute - The minutes (0-59)
 * @param {number} [second=0] - The seconds (0-59), defaulting to 0 if omitted
 * @param {number} timezone = The sheet's offset from UTC in hours (e.g., for UTC−7, pass -7)
 * @returns {Date} A Date object that represents the that moment in time
 */
function createSheetDate(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  timezone = SHEET_TIMEZONE_OFFSET,
) {
  // Construct a date using Date.UTC so that we start with a known UTC base.
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));

  // Adjust the date by subtracting the timezone offset.
  utcDate.setUTCHours(utcDate.getUTCHours() - timezone);

  return utcDate;
}

async function getSheetData(id, gid = 0) {
  const queryTextResponse = await (
    await fetch(
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${gid}`,
    )
  ).text();

  ///Need to extract the JSON part between "google.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"ok","sig":"1053501725","table":{cols: [...], rows: [...]}});"
  const jsonString = queryTextResponse.match(/(?<="table":).*(?=}\);)/g)[0];
  const json = JSON.parse(jsonString);
  const table = [];
  const row = [];
  const dateRegexp = /Date\((.*)\)/;
  json.cols.forEach((column) => row.push(column.label));
  table.push(row);
  json.rows.forEach((r) => {
    const row = [];
    r.c.forEach((cel) => {
      let value = "";
      if (cel && (cel.f || cel.v)) {
        // cel.v is the actual value, cel.f is the formatted value.
        // i.e. { v: "Date(2025,2,30,21,1,11)", f: "30/3/2025 21:01:12" }
        if (
          cel.f &&
          cel.v &&
          typeof cel.v == "string" &&
          cel.v.startsWith("Date(")
        ) {
          const [year, month, day, hour, minute, second] = dateRegexp
            .exec(cel.v)[1]
            .split(",")
            .map(Number);
          value = createSheetDate(
            year,
            month,
            day,
            hour,
            minute,
            second,
            SHEET_TIMEZONE_OFFSET,
          ).toISOString();
        } else {
          value = cel.v || cel.f;

          if (typeof value == "string") {
            if (value.toLowerCase() == "true") value = true;
            if (value.toLowerCase() == "false") value = false;
          }
        }
      }
      row.push(typeof value == "string" ? value.trim() : value);
    });
    const allValuesAreEmpty = row.reduce((acc, curr) => acc && !curr, true);
    if (allValuesAreEmpty) return;

    table.push(row);
  });
  const usesFirstDataRowAsHeaders = row.every((header) => !header);
  return table_to_objects(
    usesFirstDataRowAsHeaders ? [table[1], ...table.slice(2)] : table,
  );
}

/* 
    Receive a gsheet array as input in the form of
    [
        ['header a', 'header b', 'header c'],
        ['value 1 a', 'value 1 b', 'value 1 c'],
        ['value 2 a', 'value 2 b', 'value 2 c'],
    ]
    
    Output the corresponding json object associated
    [
        {
            'header a': 'value 1 a',
            'header b': 'value 1 b',
            'header c': 'value 1 c'
        },
        {
            'header a': 'value 2 a',
            'header b': 'value 2 b',
            'header c': 'value 2 c'
        }
    ]
*/
function table_to_objects(gsheet_array) {
  // array containing the jsons
  let final_object = [];

  // iterate over the gsheet array receives from 1 to end
  for (let row_values = 1; row_values < gsheet_array.length; row_values++) {
    // each row in the gheet array will represent an object
    const row = gsheet_array[row_values];
    // store the index of the headers
    let index_keys = 0;
    // create a temporary object holding to hold the values of each row
    let temp_object = {};

    // loop over each row
    for (let index_value = 0; index_value < row.length; index_value++) {
      // get each value and assign it as a value to the respective key
      const value = row[index_value];
      temp_object[gsheet_array[index_keys][index_value]] =
        gsheet_array[row_values][index_value];
    }

    // append the current temporary object to the final array of objects
    final_object.push(temp_object);
  }

  // return the final array of json
  return final_object;
}

export { getGoogleSheetData };
