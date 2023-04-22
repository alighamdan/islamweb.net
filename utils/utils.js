/**
 *
 * @param {string} string
 * @param {any} data
 * @returns {string}
 */
function replace(string, data) {
  return string
    .replace(
      /{islamic_date}/gi,
      data?.language === "ar"
        ? new Date().toLocaleDateString("ar-SA-islamic-umalqura")
        : new Date().toLocaleDateString()
    )
    .replace(/\"/gi, '\\"')
    .replace(/\{\w+\}/gi, (str) => {
      let key = str.slice(1, -1);
      if (data[key]) {
        return data[key];
      } else {
        return str;
      }
    });
}

module.exports.replace = replace;
module.exports.supportedOrientation = ["Portrait", "Landscape"];
module.exports.supportedPaperSizes = [
  "A0",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "A9",
  "B0",
  "B1",
  "B10",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "B7",
  "B8",
  "B9",
  "C5E",
  "Comm10E",
  "DLE",
  "Executive",
  "Folio",
  "Ledger",
  "Legal",
  "Letter",
  "Tabloid",
];
