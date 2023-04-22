const fs = require("fs");
const path = require("path");
const isEmail = require("email-regex-safe");
const { execSync } = require("child_process");
const {
  replace,
  supportedOrientation,
  supportedPaperSizes,
} = require("../../utils/utils");
const { parseHTML } = require("linkedom");
const surah = require("../../utils/db/surah.json");
const iconv_lite = require("iconv-lite");

module.exports = class IslamWebLibrary {
  /**
   * @param {string} html
   */
  constructor(html) {
    this.source = html
      .replace(/\<font color="green"/gi, '<font color="#80e36a"')
      .replace(/\<font color="brown"/gi, '<font color="#dc5c53"')
      .replace(/\<font color="blue"/gi, '<font color="#1E90FF"');
  }

  getDetails(html = false, tashkel = true) {
    let document = parseHTML(this.source).window.document;
    let language =
      document.querySelector('link[rel="amphtml"]')?.href?.split("/")?.[4] ||
      "ar";
    document
      .querySelectorAll("span img[alt]")
      .forEach(
        (el) =>
          (el.outerHTML = `<span style="color:gold">${el.alt.trim()}</span>`)
      );
    let tree =
      Array.from(document.querySelectorAll("ol li"))
        .map((e) => e.textContent.trim())
        .join(" >> ") || undefined;
    let title = Array.from(
      document.querySelectorAll('div[itemprop="itemListElement"]')
    )
      ?.reverse()?.[0]
      ?.querySelector("span")?.textContent;
    let folder = Array.from(
      document.querySelectorAll('div[itemprop="itemListElement"]')
    )
      ?.reverse()?.[1]
      ?.querySelector("span")
      ?.textContent?.trim();
    let bookName = document
      .querySelector(".booktitleandservices")
      ?.textContent?.trim()
      ?.split("\n")?.[0]
      ?.trim();
    let author = document
      .querySelector(".booktitleandservices")
      ?.textContent?.trim()
      ?.split("\n")?.[1]
      ?.trim();
    let pageNo = +(
      document.querySelector("#currentpage")?.value ||
      document
        .querySelector(".booktitleandservices a")
        ?.href?.split("&")
        ?.reverse()?.[0]
        ?.split("=")?.[1]
    );
    let tab_id;
    try {
      tab_id = new URL(
        document.querySelector('link[rel="amphtml"]').href
      ).searchParams.get("ID");
      if (tab_id) tab_id = +tab_id;
    } catch (error) {}
    let book_ID = +(
      document.querySelector('input[name="bk_no"]')?.value ||
      document
        .querySelector('link[rel="amphtml"]')
        ?.href?.split("=")
        ?.reverse()?.[0]
    );
    let previousTab = document.querySelector("a.topprevbutton")?.href
      ? `https://www.islamweb.net/${language}/library/${
          document.querySelector("a.topprevbutton").href
        }`
      : book_ID && tab_id
      ? `https://www.islamweb.net/ar/library/index.php?page=bookcontents&ID=${
          +tab_id - 1
        }&bk_no=${+book_ID}&flag=1`
      : undefined;
    let nextTab = document.querySelector("a.topnextbutton")?.href
      ? `https://www.islamweb.net/${language}/library/${
          document.querySelector("a.topnextbutton").href
        }`
      : book_ID && tab_id
      ? `https://www.islamweb.net/ar/library/index.php?page=bookcontents&ID=${
          +tab_id + 1
        }&bk_no=${+book_ID}&flag=1`
      : undefined;
    let last_page = +document
      .querySelector('form input[name="pageno"]')
      ?.getAttribute("data-pagemax");
    let first_page = +document
      .querySelector('form input[name="pageno"]')
      ?.getAttribute("data-pagemin");
    let part = +document.querySelector("form input#selectedpart")?.value;
    document.querySelectorAll("span[class$=att]").forEach((el) => el.remove());
    let tab_content =
      document
        .querySelector(tashkel ? "#pagebody_thaskeel" : "#pagebody")
        ?.[html ? "innerHTML" : "textContent"]?.trim()
        ?.replace(/\t/g, " ")
        ?.replace(/\s{2,}/g, " ") || undefined;
    let content_explain =
      document
        .querySelector(tashkel ? ".taskeel #pagebody" : ".notaskeel #pagebody")
        ?.[html ? "innerHTML" : "textContent"]?.trim()
        ?.replace(/\t/g, " ")
        ?.replace(/\s{2,}/g, " ") || undefined;

    return {
      title,
      tree,
      folder,
      bookName,
      author,
      pageNo,
      previousTab,
      nextTab,
      last_page,
      first_page,
      part,
      book_ID,
      tab_content,
      content_explain,
      language,
      tab_id,
    };
  }

  async print(
    {
      headersAndFooter: headersAndFooters,
      margin,
      size,
      orientation,
      executablePath,
    } = {
      headersAndFooter: true,
      margin: 6,
      size: "Letter",
      orientation: "Portrait",
      executablePath: process.env.WKHTMLTOPDF,
    }
  ) {
    headersAndFooters = Boolean(headersAndFooters);
    margin = isNaN(margin) || margin < 0 ? 6 : margin;
    size = supportedPaperSizes.includes(size) ? size : "Letter";
    orientation = supportedOrientation.includes(orientation)
      ? orientation
      : "Portrait";
    executablePath = fs.existsSync(executablePath)
      ? executablePath
      : process.env.WKHTMLTOPDF;
    if (!executablePath) {
      throw new ReferenceError(
        `Can't Find WkHtmlToPdf executable File \`set the path in process.env.WKHTMLTOPDF or in the options\``
      );
    }
    let d = this.getDetails(true);
    if (!d.title || !d.tab_content || !d.bookName) {
      throw new Error("check if this is a valid fatwa url - or refetch...");
    }
    let cmd = `"${executablePath}" `;
    cmd += `--log-level none -s "${size}" -O "${orientation}" --enable-local-file-access `;
    if (headersAndFooters) {
      cmd += `--header-left "${replace(
        d.language == "ar" ? `{islamic_date}` : `{title}`,
        d
      )}" `;
      cmd += `--header-right "${replace(
        d.language == "ar" ? `{title}` : `{islamic_date}`,
        d
      )}" `;
      cmd += `--footer-left "${this.url}" `;
      cmd += `--footer-right "Page [page]/[topage]" `;
    }
    cmd += `-T ${margin}mm -B ${margin}mm `;
    cmd += `-L ${Math.floor(margin / 2)}mm -R ${Math.floor(margin / 2)}mm `;
    cmd += `--footer-font-size 8 - -`;
    return execSync(cmd, {
      input: fs
        .readFileSync(
          path.resolve(
            __dirname,
            "..",
            "..",
            "utils",
            "templates",
            d.content_explain ? "fatwa" : "article",
            "index.html"
          ),
          "utf-8"
        )
        .replace('"{DIRECTION}"', d.language == "ar" ? "rtl" : "ltr")
        .replace(/\{IMG\}/gi, "")
        .replace(/\{BODY\}/gi, d.tab_content)
        .replace(/سؤال/gi, "النص")
        .replace(
          '<h2 class="ajabh">جواب</h2>',
          d.content_explain ? "الشرح" : ""
        )
        .replace(/\{QUESTION\}/gi, d.tab_content)
        .replace(/\{ANSWER\}/gi, d.content_explain || ""),
      maxBuffer: 99999999999999999999,
    });
  }

  share(media = "whatsapp") {
    let { title } = this.getDetails();
    if (media === "whatsapp") {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(
        this.url
      )}`;
    } else if (media === "twitter") {
      return `https://twitter.com/intent/tweet?original_referer=${encodeURIComponent(
        "https://www.islamweb.net/"
      )}&ref_src=${encodeURIComponent(
        "twsrc^tfw|twcamp^buttonembed|twterm^share|twgr^"
      )}&text=${encodeURIComponent(title)}&url=${encodeURIComponent(this.url)}`;
    } else if (isEmail({ exact: true }).test(media)) {
      return `mailto:${encodeURIComponent(media)}?subject=${encodeURIComponent(
        title
      )}&body=${encodeURIComponent(this.url)}`;
    }
    throw new Error("Only 'whatsapp', 'twitter', 'mail' available");
  }

  get url() {
    let d = this.getDetails();
    return `https://www.islamweb.net/${d.language}/library/index.php?page=bookcontents&ID=${d.tab_id}&bk_no=${d.book_ID}&flag=1`;
  }
};
